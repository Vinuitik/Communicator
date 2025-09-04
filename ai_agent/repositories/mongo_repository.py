"""Async MongoDB repository using motor.

Provides a minimal CRUD wrapper suitable for the project. Uses configuration
from the settings module for connection parameters.
"""
from typing import Optional, Any
import os
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from config.settings import settings


class MongoRepository:
    """Simple MongoDB repository using configuration from settings.

    Contract:
    - Input: Configuration from settings.py (loads from config.yaml)
    - Output: `db` attribute (AsyncIOMotorDatabase) for collection access
    - Error modes: initialize() raises on failure
    """

    def __init__(self, url: Optional[str] = None, db_name: Optional[str] = None):
        # Use settings configuration or fallback to provided parameters
        mongo_config = settings.get_mongodb_connection_params()
        self._url = url or mongo_config["url"]
        self._db_name = db_name or mongo_config["db_name"]
        self._connection_timeout = mongo_config["connection_timeout"]
        self._server_selection_timeout = mongo_config["server_selection_timeout"]
        self._max_pool_size = mongo_config["max_pool_size"]
        self._min_pool_size = mongo_config["min_pool_size"]
        
        self.client: Optional[AsyncIOMotorClient] = None
        self.db: Optional[AsyncIOMotorDatabase] = None

    async def initialize(self):
        if self.client is None:
            self.client = AsyncIOMotorClient(
                self._url,
                serverSelectionTimeoutMS=self._server_selection_timeout,
                connectTimeoutMS=self._connection_timeout,
                maxPoolSize=self._max_pool_size,
                minPoolSize=self._min_pool_size
            )
            # lazy create db handle
            self.db = self.client[self._db_name]
            # Validate connection by pinging the database
            # This may raise if connection fails
            await self.client.admin.command("ping")

    async def insert_one(self, collection: str, document: dict) -> Any:
        if self.db is None:
            raise RuntimeError("MongoDB client is not initialized")
        res = await self.db[collection].insert_one(document)
        return res.inserted_id

    async def find_one(self, collection: str, filter: dict) -> Optional[dict]:
        if self.db is None:
            raise RuntimeError("MongoDB client is not initialized")
        return await self.db[collection].find_one(filter)

    async def update_one(self, collection: str, filter: dict, update: dict, upsert: bool = False) -> dict:
        if self.db is None:
            raise RuntimeError("MongoDB client is not initialized")
        res = await self.db[collection].update_one(filter, update, upsert=upsert)
        return {"matched_count": res.matched_count, "modified_count": res.modified_count, "upserted_id": getattr(res, 'upserted_id', None)}

    async def delete_one(self, collection: str, filter: dict) -> int:
        if self.db is None:
            raise RuntimeError("MongoDB client is not initialized")
        res = await self.db[collection].delete_one(filter)
        return res.deleted_count

    async def close(self):
        if self.client is not None:
            self.client.close()
            self.client = None
            self.db = None
