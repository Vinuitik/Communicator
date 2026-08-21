"""Async Redis repository used by the ai_agent services.

This module provides a small wrapper around redis.asyncio.Redis that
matches the project's dependency-injection style and uses configuration
from the settings module.
"""
from typing import Optional
import os
import asyncio
import redis.asyncio as aioredis
from config.settings import settings


class RedisRepository:
    """Provides a redis client instance and simple helper operations.

    Contract:
    - Inputs: Configuration from settings.py (loads from config.yaml)
    - Outputs: an async Redis client available via `client` attribute
    - Error modes: raises on connection errors when `initialize` is called
    - Success: `initialize()` connects and `close()` cleans up
    """

    def __init__(self, url: Optional[str] = None):
        # Use settings configuration or fallback to provided parameters
        redis_config = settings.get_redis_connection_params()
        self._url = url or redis_config["url"]
        self._db = redis_config["db"]
        self._socket_timeout = redis_config["socket_timeout"]
        self._retry_on_timeout = redis_config["retry_on_timeout"]
        self._max_connections = redis_config["max_connections"]
        
        self.client: Optional[aioredis.Redis] = None

    async def initialize(self):
        """Create the redis client and verify connectivity."""
        if self.client is None:
            self.client = aioredis.from_url(
                self._url, 
                decode_responses=True,
                db=self._db,
                socket_timeout=self._socket_timeout,
                retry_on_timeout=self._retry_on_timeout,
                max_connections=self._max_connections
            )
            # Try a ping to validate connection; allow user to handle failures
            try:
                await self.client.ping()
            except Exception:
                # Close client on failure to avoid leaked connections
                try:
                    await self.client.close()
                except Exception:
                    pass
                self.client = None
                raise

    async def get(self, key: str):
        if not self.client:
            raise RuntimeError("Redis client is not initialized")
        return await self.client.get(key)

    async def set(self, key: str, value, ex: Optional[int] = None):
        if not self.client:
            raise RuntimeError("Redis client is not initialized")
        return await self.client.set(key, value, ex=ex)

    async def create(self, key: str, value, ex: Optional[int] = None) -> bool:
        """Create a key/value only if the key does not already exist.

        Returns True if the key was created, False if it already existed.
        """
        if not self.client:
            raise RuntimeError("Redis client is not initialized")
        # Use NX flag to set only when key does not exist.
        result = await self.client.set(key, value, ex=ex, nx=True)
        # redis-py returns True if set, None or False if not set depending on version
        return bool(result)

    async def delete(self, key: str):
        if not self.client:
            raise RuntimeError("Redis client is not initialized")
        return await self.client.delete(key)

    async def close(self):
        if self.client:
            try:
                await self.client.close()
            finally:
                self.client = None

    async def upsert(self, key: str, value, ex: Optional[int] = None):
        """Alias for set - creates or updates the key unconditionally.

        This mirrors unordered_map behavior where assignment inserts or updates.
        """
        return await self.set(key, value, ex=ex)

    async def compare_and_swap(self, key: str, expected, new, max_retries: int = 3) -> bool:
        """Atomically set `key` to `new` only if its current value equals `expected`.

        Returns True if the swap succeeded, False otherwise. Uses WATCH/MULTI/EXEC
        to provide the compare-and-set semantics.
        """
        if not self.client:
            raise RuntimeError("Redis client is not initialized")

        for _ in range(max_retries):
            try:
                # Watch the key for changes
                await self.client.watch(key)
                current = await self.client.get(key)
                # If current value doesn't match expected, abort and unwatch
                if current != expected:
                    await self.client.unwatch()
                    return False

                # Start transaction
                tr = self.client.multi_exec()
                tr.set(key, new)
                await tr.execute()
                return True
            except aioredis.exceptions.WatchError:
                # Retry on concurrent modification
                continue
            finally:
                try:
                    await self.client.unwatch()
                except Exception:
                    pass

        return False
