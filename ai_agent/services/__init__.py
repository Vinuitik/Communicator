"""Services module for AI Agent.

This module provides various services for the AI Agent application:
- AgentService: LLM operations and response generation
- EmbeddingService: Text embedding using HuggingFace API
- KnowledgeService: Knowledge summarization and management
- CitationService: Legacy citation and source finding (deprecated)
- ChunkingService: Knowledge text chunking and embedding
- SearchService: Vector similarity search using FAISS
- ReferencingService: Fact validation and reference management
"""

from .agent_service import AgentService
from .embedding_service import EmbeddingService
from .knowledge_service import KnowledgeService
from .citations_service import CitationService
from .chunking_service import ChunkingService
from .search_service import SearchService
from .referencing_service import ReferencingService

__all__ = [
    "AgentService",
    "EmbeddingService",
    "KnowledgeService",
    "CitationService",
    "ChunkingService",
    "SearchService",
    "ReferencingService"
]
