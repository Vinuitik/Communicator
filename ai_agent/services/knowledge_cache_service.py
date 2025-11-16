"""Knowledge Cache Service - manages Redis caching for knowledge summaries.

This service handles caching logic for friend knowledge summaries,
separating cache concerns from business logic.
"""
import logging
from typing import Optional

logger = logging.getLogger(__name__)


class KnowledgeCacheService:
    """Manages Redis cache for knowledge summaries.
    
    Features:
    - Cache existence checking
    - Summary caching and invalidation
    - Consistent cache key generation
    """

    def __init__(self, redis_repo):
        """Initialize the cache service.
        
        Args:
            redis_repo: Redis repository for cache operations
        """
        self.redis_repo = redis_repo
        logger.info("Initialized KnowledgeCacheService")

    def _get_cache_key(self, friend_id: int) -> str:
        """Generate consistent cache key for a friend's summary.
        
        Args:
            friend_id: ID of the friend
            
        Returns:
            Cache key string
        """
        return f"friend_summary:{friend_id}"

    async def is_summary_cached(self, friend_id: int) -> bool:
        """Check if a friend's summary exists in cache.
        
        Args:
            friend_id: ID of the friend
            
        Returns:
            True if cached, False otherwise
        """
        cache_key = self._get_cache_key(friend_id)
        logger.debug(f"Checking cache for key: {cache_key}")
        
        cached_value = await self.redis_repo.get(cache_key)
        exists = cached_value is not None
        
        if exists:
            logger.debug(f"Cache HIT for friend {friend_id}")
        else:
            logger.debug(f"Cache MISS for friend {friend_id}")
        
        return exists

    async def cache_summary(self, friend_id: int) -> None:
        """Mark a friend's summary as cached.
        
        Args:
            friend_id: ID of the friend
        """
        cache_key = self._get_cache_key(friend_id)
        logger.info(f"Caching summary for friend {friend_id} with key: {cache_key}")
        
        # Store a simple marker value (no expiration - permanent cache)
        await self.redis_repo.set(cache_key, "cached")
        
        logger.debug(f"Successfully cached friend {friend_id}")

    async def invalidate_summary(self, friend_id: int) -> None:
        """Invalidate (delete) a friend's cached summary.
        
        Called when knowledge changes and summary needs regeneration.
        
        Args:
            friend_id: ID of the friend
        """
        cache_key = self._get_cache_key(friend_id)
        logger.info(f"Invalidating cache for friend {friend_id}")
        
        await self.redis_repo.delete(cache_key)
        
        logger.debug(f"Successfully invalidated cache for friend {friend_id}")

    async def get_all_cached_friend_ids(self) -> list:
        """Get all friend IDs that have cached summaries.
        
        Useful for cache management and debugging.
        
        Returns:
            List of friend IDs with cached summaries
        """
        # Get all keys matching the pattern
        pattern = "friend_summary:*"
        keys = await self.redis_repo.keys(pattern)
        
        # Extract friend IDs from keys
        friend_ids = []
        for key in keys:
            try:
                # Extract ID from "friend_summary:123" format
                friend_id = int(key.split(":")[-1])
                friend_ids.append(friend_id)
            except (ValueError, IndexError):
                logger.warning(f"Invalid cache key format: {key}")
        
        logger.info(f"Found {len(friend_ids)} cached friend summaries")
        return friend_ids
