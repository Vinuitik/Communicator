"""Fact Repository - handles PostgreSQL operations for friend summaries and facts.

This repository provides a clean abstraction layer for all fact-related
database operations, separating persistence logic from business logic.

facts is stored as a JSONB array on one row per friend (friend_summaries),
mirroring the old Mongo document shape. Array mutations (push/pull/positional
update) go through jsonb_array_elements()/jsonb_agg() rather than a generic
dict-filter adapter — PostgresRepository's find/insert helpers don't cover
this shape, so this repository talks to postgres_repo.pool directly.
"""
from typing import Dict, Any, List, Optional
import logging
from datetime import datetime, timezone

from models.schemas import FactDocument

logger = logging.getLogger(__name__)


class FactRepository:
    """Handles PostgreSQL operations for friend summaries and facts.

    Features:
    - CRUD operations for facts
    - Friend summary management
    - Fact count tracking
    - Clean abstraction over PostgreSQL JSONB array operations
    """

    def __init__(self, postgres_repo):
        """Initialize the fact repository.

        Args:
            postgres_repo: PostgresRepository instance (uses its .pool)
        """
        self.postgres_repo = postgres_repo
        logger.info("Initialized FactRepository")

    async def get_friend_summary(self, friend_id: int) -> Optional[Dict[str, Any]]:
        """Get the complete summary document for a friend.

        Args:
            friend_id: ID of the friend

        Returns:
            Summary document with facts array, or None if not found
        """
        logger.debug(f"Fetching summary for friend {friend_id}")

        async with self.postgres_repo.pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT friend_id, facts, fact_count, last_updated "
                "FROM friend_summaries WHERE friend_id = $1",
                friend_id
            )

        if row:
            summary = dict(row)
            logger.debug(f"Found summary for friend {friend_id} with {summary.get('fact_count', 0)} facts")
            return summary
        else:
            logger.debug(f"No summary found for friend {friend_id}")
            return None

    async def save_fact(
        self,
        friend_id: int,
        fact: FactDocument
    ) -> None:
        """Add a fact to a friend's summary.

        Creates summary document if it doesn't exist.

        Args:
            friend_id: ID of the friend
            fact: Fact document to add
        """
        logger.info(f"Saving fact {fact.fact_id} for friend {friend_id}")

        async with self.postgres_repo.pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO friend_summaries (friend_id, facts, fact_count, last_updated)
                VALUES ($1, jsonb_build_array($2::jsonb), 1, now())
                ON CONFLICT (friend_id) DO UPDATE SET
                    facts = friend_summaries.facts || $2::jsonb,
                    fact_count = friend_summaries.fact_count + 1,
                    last_updated = now()
                """,
                friend_id, fact.dict()
            )

        logger.debug(f"Successfully saved fact {fact.fact_id}")

    async def get_facts_for_friend(self, friend_id: int) -> List[Dict[str, Any]]:
        """Get all facts for a friend.

        Args:
            friend_id: ID of the friend

        Returns:
            List of fact dictionaries (empty list if none found)
        """
        logger.debug(f"Fetching facts for friend {friend_id}")

        summary = await self.get_friend_summary(friend_id)

        if not summary or "facts" not in summary:
            logger.debug(f"No facts found for friend {friend_id}")
            return []

        facts = summary.get("facts", [])
        logger.debug(f"Retrieved {len(facts)} facts for friend {friend_id}")

        return facts

    async def delete_fact(self, friend_id: int, fact_id: str) -> None:
        """Delete a specific fact from a friend's summary.

        Args:
            friend_id: ID of the friend
            fact_id: ID of the fact to delete
        """
        logger.info(f"Deleting fact {fact_id} for friend {friend_id}")

        async with self.postgres_repo.pool.acquire() as conn:
            await conn.execute(
                """
                UPDATE friend_summaries SET
                    facts = COALESCE(
                        (SELECT jsonb_agg(elem) FROM jsonb_array_elements(facts) elem
                         WHERE elem->>'fact_id' != $2),
                        '[]'::jsonb
                    ),
                    fact_count = GREATEST(fact_count - 1, 0),
                    last_updated = now()
                WHERE friend_id = $1
                """,
                friend_id, fact_id
            )

        logger.debug(f"Successfully deleted fact {fact_id}")

    async def update_fact(
        self,
        friend_id: int,
        fact_id: str,
        updates: Dict[str, Any]
    ) -> None:
        """Update specific fields of a fact.

        Args:
            friend_id: ID of the friend
            fact_id: ID of the fact to update
            updates: Dictionary of fields to update
        """
        logger.info(f"Updating fact {fact_id} for friend {friend_id}")
        logger.debug(f"Update fields: {list(updates.keys())}")

        set_updates = dict(updates)
        set_updates["updated_at"] = datetime.now(timezone.utc)

        async with self.postgres_repo.pool.acquire() as conn:
            await conn.execute(
                """
                UPDATE friend_summaries SET
                    facts = (
                        SELECT jsonb_agg(
                            CASE WHEN elem->>'fact_id' = $2 THEN elem || $3::jsonb ELSE elem END
                        )
                        FROM jsonb_array_elements(facts) elem
                    ),
                    last_updated = now()
                WHERE friend_id = $1
                """,
                friend_id, fact_id, set_updates
            )

        logger.debug(f"Successfully updated fact {fact_id}")

    async def create_empty_summary(self, friend_id: int) -> None:
        """Create an empty summary document for a friend.

        Useful when no facts are found but we want to cache the result.

        Args:
            friend_id: ID of the friend
        """
        logger.info(f"Creating empty summary for friend {friend_id}")

        async with self.postgres_repo.pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO friend_summaries (friend_id, facts, fact_count, last_updated)
                VALUES ($1, '[]'::jsonb, 0, now())
                ON CONFLICT (friend_id) DO UPDATE SET
                    facts = '[]'::jsonb, fact_count = 0, last_updated = now()
                """,
                friend_id
            )

        logger.debug(f"Created empty summary for friend {friend_id}")

    async def get_fact_count(self, friend_id: int) -> int:
        """Get the number of facts for a friend.

        Args:
            friend_id: ID of the friend

        Returns:
            Number of facts (0 if no summary exists)
        """
        summary = await self.get_friend_summary(friend_id)

        if not summary:
            return 0

        return summary.get("fact_count", len(summary.get("facts", [])))

    async def fact_exists(self, friend_id: int, fact_id: str) -> bool:
        """Check if a specific fact exists.

        Args:
            friend_id: ID of the friend
            fact_id: ID of the fact

        Returns:
            True if fact exists, False otherwise
        """
        async with self.postgres_repo.pool.acquire() as conn:
            exists = await conn.fetchval(
                """
                SELECT EXISTS(
                    SELECT 1 FROM friend_summaries, jsonb_array_elements(facts) elem
                    WHERE friend_id = $1 AND elem->>'fact_id' = $2
                )
                """,
                friend_id, fact_id
            )

        logger.debug(f"Fact {fact_id} exists for friend {friend_id}: {exists}")

        return bool(exists)
