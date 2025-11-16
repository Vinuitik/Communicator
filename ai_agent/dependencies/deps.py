"""Dependency injection for AI agent services.

This module manages the lifecycle of all service instances using
the singleton pattern with lazy initialization.
"""
from fastapi import Depends
import logging

# Service imports
from services.agent_service import AgentService
from services.embedding_service import EmbeddingService
from services.chunking_service import ChunkingService
from services.search_service import SearchService
from services.friend_api_service import FriendApiService
from services.knowledge_cache_service import KnowledgeCacheService
from services.fact_validation_service import FactValidationService
from services.fact_service import FactService
from services.knowledge_service import KnowledgeService

# Repository imports
from repositories.redis_repository import RedisRepository
from repositories.mongo_repository import MongoRepository
from repositories.fact_repository import FactRepository

# Prompt service import
from prompts.summary_prompt_service import SummaryPromptService

# Set up logger
logger = logging.getLogger(__name__)

# Global service instances (singletons)
_agent_service = None
_embedding_service = None
_chunking_service = None
_friend_api_service = None
_knowledge_cache_service = None
_fact_validation_service = None
_search_service = None
_fact_service = None
_knowledge_service = None
_prompt_service = None

# Repository instances
_redis_repo: RedisRepository | None = None
_mongo_repo: MongoRepository | None = None
_fact_repo: FactRepository | None = None


# ==================== Repository Dependencies ====================

async def get_redis_repository() -> RedisRepository:
    """Get shared RedisRepository instance."""
    global _redis_repo
    logger.debug("Getting Redis repository instance")
    
    if _redis_repo is None:
        try:
            logger.info("Initializing new Redis repository instance")
            _redis_repo = RedisRepository()
            await _redis_repo.initialize()
            logger.info("Redis repository initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize Redis repository: {e}", exc_info=True)
            raise
    else:
        logger.debug("Returning existing Redis repository instance")
    
    return _redis_repo


async def get_mongo_repository() -> MongoRepository:
    """Get shared MongoRepository instance."""
    global _mongo_repo
    logger.debug("Getting MongoDB repository instance")
    
    if _mongo_repo is None:
        try:
            logger.info("Initializing new MongoDB repository instance")
            _mongo_repo = MongoRepository()
            await _mongo_repo.initialize()
            logger.info("MongoDB repository initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize MongoDB repository: {e}", exc_info=True)
            raise
    else:
        logger.debug("Returning existing MongoDB repository instance")
    
    return _mongo_repo


async def get_fact_repository(
    mongo_repo: MongoRepository = Depends(get_mongo_repository)
) -> FactRepository:
    """Get shared FactRepository instance."""
    global _fact_repo
    logger.debug("Getting fact repository instance")
    
    if _fact_repo is None:
        try:
            logger.info("Initializing new fact repository instance")
            _fact_repo = FactRepository(mongo_repo)
            logger.info("Fact repository initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize fact repository: {e}", exc_info=True)
            raise
    else:
        logger.debug("Returning existing fact repository instance")
    
    return _fact_repo


# ==================== Core Service Dependencies ====================

async def get_agent_service() -> AgentService:
    """Get AgentService instance."""
    global _agent_service
    logger.debug("Getting agent service instance")
    
    if _agent_service is None:
        try:
            logger.info("Initializing new agent service instance")
            _agent_service = AgentService()
            await _agent_service.initialize()
            logger.info("Agent service initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize agent service: {e}", exc_info=True)
            raise
    else:
        logger.debug("Returning existing agent service instance")
    
    return _agent_service


async def get_embedding_service() -> EmbeddingService:
    """Get EmbeddingService instance."""
    global _embedding_service
    logger.debug("Getting embedding service instance")
    
    if _embedding_service is None:
        try:
            logger.info("Initializing new embedding service instance")
            _embedding_service = EmbeddingService()
            logger.info("Embedding service initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize embedding service: {e}", exc_info=True)
            raise
    else:
        logger.debug("Returning existing embedding service instance")
    
    return _embedding_service


async def get_friend_api_service() -> FriendApiService:
    """Get FriendApiService instance."""
    global _friend_api_service
    logger.debug("Getting friend API service instance")
    
    if _friend_api_service is None:
        try:
            logger.info("Initializing new friend API service instance")
            _friend_api_service = FriendApiService()
            logger.info("Friend API service initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize friend API service: {e}", exc_info=True)
            raise
    else:
        logger.debug("Returning existing friend API service instance")
    
    return _friend_api_service


async def get_knowledge_cache_service(
    redis_repo: RedisRepository = Depends(get_redis_repository)
) -> KnowledgeCacheService:
    """Get KnowledgeCacheService instance."""
    global _knowledge_cache_service
    logger.debug("Getting knowledge cache service instance")
    
    if _knowledge_cache_service is None:
        try:
            logger.info("Initializing new knowledge cache service instance")
            _knowledge_cache_service = KnowledgeCacheService(redis_repo)
            logger.info("Knowledge cache service initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize knowledge cache service: {e}", exc_info=True)
            raise
    else:
        logger.debug("Returning existing knowledge cache service instance")
    
    return _knowledge_cache_service


async def get_prompt_service() -> SummaryPromptService:
    """Get SummaryPromptService instance."""
    global _prompt_service
    logger.debug("Getting prompt service instance")
    
    if _prompt_service is None:
        try:
            logger.info("Initializing new prompt service instance")
            _prompt_service = SummaryPromptService()
            logger.info("Prompt service initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize prompt service: {e}", exc_info=True)
            raise
    else:
        logger.debug("Returning existing prompt service instance")
    
    return _prompt_service


# ==================== Validation & Processing Dependencies ====================

async def get_fact_validation_service(
    agent_service: AgentService = Depends(get_agent_service)
) -> FactValidationService:
    """Get FactValidationService instance."""
    global _fact_validation_service
    logger.debug("Getting fact validation service instance")
    
    if _fact_validation_service is None:
        try:
            logger.info("Initializing new fact validation service instance")
            _fact_validation_service = FactValidationService(agent_service)
            logger.info("Fact validation service initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize fact validation service: {e}", exc_info=True)
            raise
    else:
        logger.debug("Returning existing fact validation service instance")
    
    return _fact_validation_service


async def get_chunking_service(
    embedding_service: EmbeddingService = Depends(get_embedding_service),
    mongo_repo: MongoRepository = Depends(get_mongo_repository)
) -> ChunkingService:
    """Get ChunkingService instance."""
    global _chunking_service
    logger.debug("Getting chunking service instance")
    
    if _chunking_service is None:
        try:
            logger.info("Initializing new chunking service instance")
            _chunking_service = ChunkingService(embedding_service, mongo_repo)
            logger.info("Chunking service initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize chunking service: {e}", exc_info=True)
            raise
    else:
        logger.debug("Returning existing chunking service instance")
    
    return _chunking_service


async def get_search_service(
    embedding_service: EmbeddingService = Depends(get_embedding_service),
    friend_api_service: FriendApiService = Depends(get_friend_api_service),
    mongo_repo: MongoRepository = Depends(get_mongo_repository)
) -> SearchService:
    """Get SearchService instance."""
    global _search_service
    logger.debug("Getting search service instance")
    
    if _search_service is None:
        try:
            logger.info("Initializing new search service instance")
            _search_service = SearchService(embedding_service, friend_api_service, mongo_repo)
            logger.info("Search service initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize search service: {e}", exc_info=True)
            raise
    else:
        logger.debug("Returning existing search service instance")
    
    return _search_service


# ==================== High-Level Service Dependencies ====================

async def get_fact_service(
    search_service: SearchService = Depends(get_search_service),
    validation_service: FactValidationService = Depends(get_fact_validation_service),
    friend_api_service: FriendApiService = Depends(get_friend_api_service),
    fact_repository: FactRepository = Depends(get_fact_repository),
    mongo_repo: MongoRepository = Depends(get_mongo_repository)
) -> FactService:
    """Get FactService instance."""
    global _fact_service
    logger.debug("Getting fact service instance")
    
    if _fact_service is None:
        try:
            logger.info("Initializing new fact service instance")
            _fact_service = FactService(
                search_service,
                validation_service,
                friend_api_service,
                fact_repository,
                mongo_repo
            )
            logger.info("Fact service initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize fact service: {e}", exc_info=True)
            raise
    else:
        logger.debug("Returning existing fact service instance")
    
    return _fact_service


async def get_knowledge_service(
    agent_service: AgentService = Depends(get_agent_service),
    fact_service: FactService = Depends(get_fact_service),
    chunking_service: ChunkingService = Depends(get_chunking_service),
    friend_api_service: FriendApiService = Depends(get_friend_api_service),
    cache_service: KnowledgeCacheService = Depends(get_knowledge_cache_service),
    prompt_service: SummaryPromptService = Depends(get_prompt_service),
    fact_repository: FactRepository = Depends(get_fact_repository),
    mongo_repo: MongoRepository = Depends(get_mongo_repository)
) -> KnowledgeService:
    """Get KnowledgeService instance with all dependencies."""
    global _knowledge_service
    logger.debug("Getting knowledge service instance")
    logger.debug(
        f"Dependencies - agent: {agent_service}, fact: {fact_service}, "
        f"chunking: {chunking_service}, cache: {cache_service}"
    )
    
    if _knowledge_service is None:
        try:
            logger.info("Initializing new knowledge service instance")
            _knowledge_service = KnowledgeService(
                agent_service=agent_service,
                fact_service=fact_service,
                chunking_service=chunking_service,
                friend_api_service=friend_api_service,
                cache_service=cache_service,
                prompt_service=prompt_service,
                fact_repository=fact_repository,
                mongo_repo=mongo_repo
            )
            logger.info("Knowledge service initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize knowledge service: {e}", exc_info=True)
            raise
    else:
        logger.debug("Returning existing knowledge service instance")
    
    return _knowledge_service
