"""Friend API Service - handles all HTTP communication with Friend Java service.

This service centralizes all REST API calls to the Friend microservice,
eliminating code duplication across multiple services.
"""
from typing import List, Dict, Any, Optional, Tuple
import logging
import aiohttp
import asyncio

from config.settings import settings

logger = logging.getLogger(__name__)


class FriendApiService:
    """Handles all REST API communication with Friend Java service.
    
    Features:
    - Centralized HTTP client for Friend service
    - Concurrent batch fetching with asyncio.gather
    - Proper error handling and logging
    - Type-safe responses
    
    Endpoints Used:
    - GET /getKnowledge/{friendId}/page/{page}/size/{size} → Paginated knowledge items
    - GET /getKnowledgeText/{id} → Full text for specific knowledge ID
    - GET /getKnowledgeIds/{friendId} → All knowledge IDs for a friend
    """

    def __init__(self):
        """Initialize the Friend API service."""
        self.base_url = settings.friend_service_url
        self.timeout = settings.friend_service_timeout
        
        logger.info(f"Initialized FriendApiService - base_url={self.base_url}, timeout={self.timeout}s")

    async def fetch_knowledge_paginated(
        self, 
        friend_id: int, 
        page: int, 
        size: int
    ) -> List[Dict[str, Any]]:
        """Fetch paginated knowledge items for a friend.
        
        Calls: GET /getKnowledge/{friendId}/page/{page}/size/{size}
        
        Args:
            friend_id: ID of the friend
            page: Page number (0-indexed)
            size: Number of items per page
            
        Returns:
            List of knowledge items with structure:
            [
                {"id": 123, "fact": "text...", "importance": 5},
                ...
            ]
        """
        url = f"{self.base_url}/getKnowledge/{friend_id}/page/{page}/size/{size}"
        
        logger.info(f"Fetching paginated knowledge: friend_id={friend_id}, page={page}, size={size}")
        logger.debug(f"Request URL: {url}")
        
        try:
            async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=self.timeout)) as session:
                async with session.get(url) as response:
                    if response.status == 200:
                        knowledge_items = await response.json()
                        logger.info(f"Retrieved {len(knowledge_items)} knowledge items for friend {friend_id}")
                        return knowledge_items
                    elif response.status == 404:
                        logger.warning(f"Friend {friend_id} not found or has no knowledge")
                        return []
                    else:
                        error_text = await response.text()
                        logger.error(
                            f"Failed to fetch knowledge for friend {friend_id}: "
                            f"HTTP {response.status} - {error_text}"
                        )
                        return []
        except aiohttp.ClientError as e:
            logger.error(f"Network error fetching knowledge for friend {friend_id}: {e}")
            return []
        except Exception as e:
            logger.error(f"Unexpected error fetching knowledge for friend {friend_id}: {e}", exc_info=True)
            return []

    async def fetch_knowledge_text(self, knowledge_id: int) -> Optional[str]:
        """Fetch full text for a specific knowledge item.
        
        Calls: GET /getKnowledgeText/{id}
        
        Args:
            knowledge_id: ID of the knowledge item
            
        Returns:
            Full knowledge text or None if not found
        """
        url = f"{self.base_url}/getKnowledgeText/{knowledge_id}"
        
        logger.debug(f"Fetching knowledge text for ID {knowledge_id}")
        
        try:
            async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=self.timeout)) as session:
                async with session.get(url) as response:
                    if response.status == 200:
                        knowledge_item = await response.json()
                        # Response format: {"id": "123", "text": "..."}
                        text = knowledge_item.get("text")
                        if text:
                            logger.debug(f"Retrieved knowledge text for ID {knowledge_id} ({len(text)} chars)")
                            return text
                        else:
                            logger.warning(f"Knowledge {knowledge_id} has no text content")
                            return None
                    elif response.status == 404:
                        logger.warning(f"Knowledge {knowledge_id} not found")
                        return None
                    else:
                        error_text = await response.text()
                        logger.error(
                            f"Failed to fetch knowledge {knowledge_id}: "
                            f"HTTP {response.status} - {error_text}"
                        )
                        return None
        except aiohttp.ClientError as e:
            logger.error(f"Network error fetching knowledge {knowledge_id}: {e}")
            return None
        except Exception as e:
            logger.error(f"Unexpected error fetching knowledge {knowledge_id}: {e}", exc_info=True)
            return None

    async def _fetch_single_knowledge(
        self, 
        session: aiohttp.ClientSession, 
        knowledge_id: int
    ) -> Tuple[int, Optional[str]]:
        """Helper method to fetch a single knowledge item within an existing session.
        
        Args:
            session: Active aiohttp ClientSession
            knowledge_id: Knowledge ID to fetch
            
        Returns:
            Tuple of (knowledge_id, text) or (knowledge_id, None) if failed
        """
        url = f"{self.base_url}/getKnowledgeText/{knowledge_id}"
        
        try:
            async with session.get(url) as response:
                if response.status == 200:
                    knowledge_item = await response.json()
                    text = knowledge_item.get("text")
                    if text:
                        return (knowledge_id, text)
                    else:
                        logger.warning(f"Knowledge {knowledge_id} has no text content")
                        return (knowledge_id, None)
                else:
                    logger.error(f"Failed to fetch knowledge {knowledge_id}: HTTP {response.status}")
                    return (knowledge_id, None)
        except Exception as e:
            logger.error(f"Error fetching knowledge {knowledge_id}: {e}")
            return (knowledge_id, None)

    async def fetch_knowledge_texts_batch(
        self, 
        knowledge_ids: List[int]
    ) -> Dict[int, str]:
        """Fetch full texts for multiple knowledge items concurrently.
        
        Uses asyncio.gather for parallel fetching.
        
        Args:
            knowledge_ids: List of knowledge IDs to fetch
            
        Returns:
            Dictionary mapping knowledge_id to full text
            Only includes successfully fetched items
        """
        logger.info(f"Fetching {len(knowledge_ids)} knowledge texts in batch")
        
        knowledge_texts = {}
        
        try:
            async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=self.timeout)) as session:
                # Create tasks for concurrent fetching
                tasks = [
                    self._fetch_single_knowledge(session, knowledge_id)
                    for knowledge_id in knowledge_ids
                ]
                
                # Execute all requests concurrently
                results = await asyncio.gather(*tasks, return_exceptions=True)
                
                # Process results
                for result in results:
                    if isinstance(result, tuple):
                        k_id, text = result
                        if text:
                            knowledge_texts[k_id] = text
                    elif isinstance(result, Exception):
                        logger.error(f"Error in batch fetch: {result}")
                
                logger.info(f"Successfully fetched {len(knowledge_texts)}/{len(knowledge_ids)} knowledge texts")
                return knowledge_texts
                
        except Exception as e:
            logger.error(f"Unexpected error in batch fetch: {e}", exc_info=True)
            return {}

    async def fetch_knowledge_ids_for_friend(self, friend_id: int) -> List[int]:
        """Fetch all knowledge IDs for a specific friend.
        
        Calls: GET /getKnowledgeIds/{friendId}
        
        Args:
            friend_id: ID of the friend
            
        Returns:
            List of knowledge IDs (empty list if none found)
        """
        url = f"{self.base_url}/getKnowledgeIds/{friend_id}"
        
        logger.info(f"Fetching knowledge IDs for friend {friend_id}")
        logger.debug(f"Request URL: {url}")
        
        try:
            async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=self.timeout)) as session:
                async with session.get(url) as response:
                    if response.status == 200:
                        knowledge_ids = await response.json()
                        # Response is already a List<Integer>
                        logger.info(f"Retrieved {len(knowledge_ids)} knowledge IDs for friend {friend_id}")
                        return knowledge_ids
                    elif response.status == 404:
                        logger.warning(f"Friend {friend_id} not found or has no knowledge")
                        return []
                    else:
                        error_text = await response.text()
                        logger.error(
                            f"Failed to fetch knowledge IDs for friend {friend_id}: "
                            f"HTTP {response.status} - {error_text}"
                        )
                        return []
        except aiohttp.ClientError as e:
            logger.error(f"Network error fetching knowledge IDs for friend {friend_id}: {e}")
            return []
        except Exception as e:
            logger.error(f"Unexpected error fetching knowledge IDs for friend {friend_id}: {e}", exc_info=True)
            return []
