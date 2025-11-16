"""Services module for AI Agent.

This module provides various services for the AI Agent application:
- AgentService: LLM operations and response generation
- EmbeddingService: Text embedding using HuggingFace API
- KnowledgeService: Knowledge summarization and management
- ChunkingService: Knowledge text chunking and embedding
- SearchService: Vector similarity search using FAISS
- FactService: Fact validation and reference management (replaces ReferencingService)
- FriendApiService: HTTP client for Friend service API
- KnowledgeCacheService: Redis caching for knowledge summaries
- FactValidationService: AI-based fact validation
"""

from .agent_service import AgentService
from .embedding_service import EmbeddingService
from .chunking_service import ChunkingService
from .search_service import SearchService
from .friend_api_service import FriendApiService
from .knowledge_cache_service import KnowledgeCacheService
from .fact_validation_service import FactValidationService
from .fact_service import FactService

__all__ = [
    "AgentService",
    "EmbeddingService",
    "ChunkingService",
    "SearchService",
    "FriendApiService",
    "KnowledgeCacheService",
    "FactValidationService",
    "FactService"
]
