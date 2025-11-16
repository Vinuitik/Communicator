"""Fact Repository - handles MongoDB operations for friend summaries and facts.

This repository provides a clean abstraction layer for all fact-related
database operations, separating persistence logic from business logic.
"""
from typing import Dict, Any, List, Optional
import logging
from datetime import datetime, timezone

from models.schemas import FactDocument

logger = logging.getLogger(__name__)


class FactRepository:
    """Handles MongoDB operations for friend summaries and facts.
    
    Features:
    - CRUD operations for facts
    - Friend summary management
    - Fact count tracking
    - Clean abstraction over MongoDB operations
    """

    def __init__(self, mongo_repo):
        """Initialize the fact repository.
        
        Args:
            mongo_repo: MongoDB repository instance
        """
        self.mongo_repo = mongo_repo
        logger.info("Initialized FactRepository")

    async def get_friend_summary(self, friend_id: int) -> Optional[Dict[str, Any]]:
        """Get the complete summary document for a friend.
        
        Args:
            friend_id: ID of the friend
            
        Returns:
            Summary document with facts array, or None if not found
        """
        logger.debug(f"Fetching summary for friend {friend_id}")
        
        summary = await self.mongo_repo.find_one(
            "friend_summaries",
            {"friend_id": friend_id}
        )
        
        if summary:
            logger.debug(f"Found summary for friend {friend_id} with {summary.get('fact_count', 0)} facts")
        else:
            logger.debug(f"No summary found for friend {friend_id}")
        
        return summary

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
        
        await self.mongo_repo.update_one(
            "friend_summaries",
            {"friend_id": friend_id},
            {
                "$push": {"facts": fact.dict()},
                "$set": {"last_updated": datetime.now(timezone.utc)},
                "$inc": {"fact_count": 1}
            },
            upsert=True
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
        
        await self.mongo_repo.update_one(
            "friend_summaries",
            {"friend_id": friend_id},
            {
                "$pull": {"facts": {"fact_id": fact_id}},
                "$set": {"last_updated": datetime.now(timezone.utc)},
                "$inc": {"fact_count": -1}
            }
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
        
        # Build update dict for array element
        set_updates = {
            f"facts.$.{key}": value 
            for key, value in updates.items()
        }
        set_updates["updated_at"] = datetime.now(timezone.utc)
        set_updates["last_updated"] = datetime.now(timezone.utc)
        
        await self.mongo_repo.update_one(
            "friend_summaries",
            {
                "friend_id": friend_id,
                "facts.fact_id": fact_id
            },
            {"$set": set_updates}
        )
        
        logger.debug(f"Successfully updated fact {fact_id}")

    async def create_empty_summary(self, friend_id: int) -> None:
        """Create an empty summary document for a friend.
        
        Useful when no facts are found but we want to cache the result.
        
        Args:
            friend_id: ID of the friend
        """
        logger.info(f"Creating empty summary for friend {friend_id}")
        
        await self.mongo_repo.update_one(
            "friend_summaries",
            {"friend_id": friend_id},
            {
                "$set": {
                    "facts": [],
                    "last_updated": datetime.now(timezone.utc),
                    "fact_count": 0
                }
            },
            upsert=True
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
        summary = await self.mongo_repo.find_one(
            "friend_summaries",
            {
                "friend_id": friend_id,
                "facts.fact_id": fact_id
            }
        )
        
        exists = summary is not None
        logger.debug(f"Fact {fact_id} exists for friend {friend_id}: {exists}")
        
        return exists
