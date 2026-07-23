"""Async PostgreSQL repository (asyncpg) backing the knowledge_chunks and
chunk_embeddings tables that replaced the Mongo collections of the same name.

Exposes the same narrow surface as MongoRepository (find_one, find_many,
insert_many, delete_many, count_documents) so ChunkingService needed no
changes beyond adding chunk_text — only these two tables are supported,
this is not a general-purpose Mongo-to-SQL translator. search_service.py
uses `pool` directly for the hybrid vector+BM25 query, which doesn't fit
this dict-filter shape.
"""
import json
import logging
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

import asyncpg
from pgvector.asyncpg import register_vector

from config.settings import settings

logger = logging.getLogger(__name__)

_TABLES = {
    "knowledge_chunks": [
        "chunk_id", "knowledge_id", "chunk_index", "chunk_text",
        "word_count", "char_start", "char_end", "text_hash", "created_at",
    ],
    "chunk_embeddings": [
        "chunk_id", "embedding", "model_name", "dimension", "created_at",
    ],
    "fact_references": [
        "fact_id", "chunk_id", "knowledge_id", "friend_id", "relevance_score",
        "validated", "validation_confidence", "created_at", "rank",
    ],
}


def _json_default(o):
    if isinstance(o, datetime):
        return o.isoformat()
    raise TypeError(f"Not JSON serializable: {o!r}")


async def _init_connection(conn: asyncpg.Connection) -> None:
    await register_vector(conn)
    # Transparent jsonb <-> python dict/list codec, used by FactRepository's
    # direct SQL against friend_summaries (array push/pull/positional-update
    # need real SQL, not the generic dict-filter adapter below).
    await conn.set_type_codec(
        "jsonb",
        encoder=lambda v: json.dumps(v, default=_json_default),
        decoder=json.loads,
        schema="pg_catalog",
        format="text",
    )


class PostgresRepository:
    """Owns the asyncpg pool for knowledge_chunks / chunk_embeddings."""

    def __init__(self, dsn: Optional[str] = None):
        self._dsn = dsn or settings.postgres_dsn
        self.pool: Optional[asyncpg.Pool] = None

    async def initialize(self) -> None:
        if self.pool is None:
            self.pool = await asyncpg.create_pool(
                self._dsn, min_size=2, max_size=10, init=_init_connection
            )
            await self._apply_schema()

    async def _apply_schema(self) -> None:
        schema_path = Path(__file__).parent.parent / "db" / "schema.sql"
        sql = schema_path.read_text()
        async with self.pool.acquire() as conn:
            await conn.execute(sql)
        logger.info("Applied knowledge_chunks/chunk_embeddings schema (idempotent)")

    async def close(self) -> None:
        if self.pool is not None:
            await self.pool.close()
            self.pool = None

    def _check_table(self, collection: str) -> None:
        if collection not in _TABLES:
            raise NotImplementedError(
                f"PostgresRepository only supports {list(_TABLES)}, got '{collection}'"
            )

    def _where(self, filter: Dict[str, Any]) -> tuple[str, list]:
        """Translate the two filter shapes actually used against these tables:
        plain equality (AND'd) and {field: {"$in": [...]}}.
        """
        clauses = []
        params: list = []
        for key, value in filter.items():
            if isinstance(value, dict) and "$in" in value:
                params.append(list(value["$in"]))
                clauses.append(f"{key} = ANY(${len(params)})")
            elif isinstance(value, dict):
                raise NotImplementedError(f"Unsupported filter operator on '{key}': {value}")
            else:
                params.append(value)
                clauses.append(f"{key} = ${len(params)}")
        where = " AND ".join(clauses) if clauses else "TRUE"
        return where, params

    async def find_one(self, collection: str, filter: Dict[str, Any]) -> Optional[dict]:
        results = await self.find_many(collection, filter, limit=1)
        return results[0] if results else None

    async def find_many(
        self, collection: str, filter: Dict[str, Any], limit: Optional[int] = None
    ) -> List[dict]:
        self._check_table(collection)
        where, params = self._where(filter)
        sql = f"SELECT * FROM {collection} WHERE {where}"
        if limit:
            sql += f" LIMIT {int(limit)}"
        async with self.pool.acquire() as conn:
            rows = await conn.fetch(sql, *params)
        return [dict(r) for r in rows]

    async def insert_many(self, collection: str, documents: List[dict]) -> int:
        """Insert documents, skipping any that violate the table's primary key.

        Returns the number of documents submitted (matches how every current
        caller uses this — none destructure a list of inserted IDs).
        """
        self._check_table(collection)
        if not documents:
            return 0
        cols = _TABLES[collection]
        col_list = ", ".join(cols)
        placeholders = ", ".join(f"${i + 1}" for i in range(len(cols)))
        # Bare ON CONFLICT DO NOTHING (no column list) so this works for both
        # single-column PKs (chunk_id) and composite ones (fact_references'
        # fact_id+chunk_id) without per-table special-casing.
        sql = (
            f"INSERT INTO {collection} ({col_list}) VALUES ({placeholders}) "
            f"ON CONFLICT DO NOTHING"
        )
        async with self.pool.acquire() as conn:
            async with conn.transaction():
                for doc in documents:
                    values = [doc.get(col) for col in cols]
                    await conn.execute(sql, *values)
        return len(documents)

    async def delete_many(self, collection: str, filter: Dict[str, Any]) -> int:
        self._check_table(collection)
        where, params = self._where(filter)
        sql = f"DELETE FROM {collection} WHERE {where}"
        async with self.pool.acquire() as conn:
            result = await conn.execute(sql, *params)
        return int(result.split()[-1])  # asyncpg returns "DELETE 3"

    async def count_documents(self, collection: str, filter: Dict[str, Any]) -> int:
        self._check_table(collection)
        where, params = self._where(filter)
        sql = f"SELECT COUNT(*) FROM {collection} WHERE {where}"
        async with self.pool.acquire() as conn:
            return await conn.fetchval(sql, *params)
