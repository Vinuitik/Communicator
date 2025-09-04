from fastapi import Depends
from services.agent_service import AgentService
from services.knowledge_service import KnowledgeService
from repositories.redis_repository import RedisRepository
import logging

# Set up logger
logger = logging.getLogger(__name__)

# Global service instances
_agent_service = None
_knowledge_service = None
_redis_repo: RedisRepository | None = None
_mongo_repo = None

async def get_agent_service() -> AgentService:
    """
    Dependency to get the agent service instance
    
    Returns:
        AgentService instance
    """
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

async def get_redis_repository() -> RedisRepository:
    """Dependency to get a shared RedisRepository instance.

    Initializes and validates the connection on first access.
    """
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


async def get_mongo_repository():
    """Dependency to get a shared MongoRepository instance."""
    global _mongo_repo
    logger.debug("Getting MongoDB repository instance")
    if _mongo_repo is None:
        try:
            logger.info("Initializing new MongoDB repository instance")
            from repositories.mongo_repository import MongoRepository

            _mongo_repo = MongoRepository()
            await _mongo_repo.initialize()
            logger.info("MongoDB repository initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize MongoDB repository: {e}", exc_info=True)
            raise
    else:
        logger.debug("Returning existing MongoDB repository instance")
    return _mongo_repo

async def get_knowledge_service(
    agent_service: AgentService = Depends(get_agent_service),
    redis_repo = Depends(get_redis_repository),
    mongo_repo = Depends(get_mongo_repository)
) -> KnowledgeService:
    """
    Dependency to get the knowledge service instance
    
    Args:
        agent_service: Injected agent service
        redis_repo: Injected Redis repository
        mongo_repo: Injected MongoDB repository
        
    Returns:
        KnowledgeService instance
    """
    global _knowledge_service
    logger.debug("Getting knowledge service instance")
    logger.debug(f"Dependencies - agent_service: {agent_service}, redis_repo: {redis_repo}, mongo_repo: {mongo_repo}")
    
    if _knowledge_service is None:
        try:
            logger.info("Initializing new knowledge service instance")
            _knowledge_service = KnowledgeService(agent_service, redis_repo, mongo_repo)
            logger.info("Knowledge service initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize knowledge service: {e}", exc_info=True)
            raise
    else:
        logger.debug("Returning existing knowledge service instance")
    
    return _knowledge_service
