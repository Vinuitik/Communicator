from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import chat, knowledge, search, settings as settings_router
from models.schemas import HealthResponse
from dependencies.deps import (
    get_agent_service, get_llm_settings_repository, get_postgres_repository,
    get_embedding_service, get_chunking_service, get_knowledge_chunk_consumer,
)
from config.settings import settings
import asyncio
import logging
import sys
import os

# Ensure logs directory exists
os.makedirs("logs", exist_ok=True)

# Configure logging based on settings
log_handlers = []

if settings.config["logging"]["console"]["enabled"]:
    log_handlers.append(logging.StreamHandler(sys.stdout))

if settings.config["logging"]["file"]["enabled"]:
    log_handlers.append(logging.FileHandler(settings.config["logging"]["file"]["path"]))

logging.basicConfig(
    level=getattr(logging, settings.log_level.upper()),
    format=settings.config["logging"]["format"],
    handlers=log_handlers
)

# Set up logger for this module
logger = logging.getLogger(__name__)

# Create FastAPI application
app = FastAPI(
    title=settings.app_name,
    description="A conversational AI agent service with knowledge integration",
    version=settings.app_version,
    debug=settings.debug
)

# Add CORS middleware using settings
cors_config = settings.config["security"]["cors"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_config["allow_origins"],
    allow_credentials=cors_config["allow_credentials"],
    allow_methods=cors_config["allow_methods"],
    allow_headers=cors_config["allow_headers"],
)

@app.on_event("startup")
async def startup_event():
    """Initialize services on application startup"""
    logger.info("Starting AI Agent Service...")
    
    # Initialize the agent service (this will trigger all dependencies).
    # Called directly here (not via a request), so FastAPI's Depends() chain
    # isn't auto-resolved — build it by hand in the same order.
    try:
        logger.info("Initializing agent service and dependencies...")
        postgres_repo = await get_postgres_repository()
        llm_settings_repo = await get_llm_settings_repository(postgres_repo)
        agent_service = await get_agent_service(llm_settings_repo)
        logger.info("AI Agent Service started successfully")
        logger.info(f"Agent service instance: {agent_service}")
    except Exception as e:
        logger.error(f"Failed to start AI Agent Service: {e}", exc_info=True)
        raise

    # Knowledge chunk-trigger RabbitMQ consumer (knowledge.chunk.trigger queue) — started
    # as a background task, NOT awaited inline like the agent chain above. Unlike MCP init
    # (which fails startup hard if it can't init), a RabbitMQ outage must not delay or block
    # ai-agent becoming ready to serve chat/summarize, which don't depend on this queue at
    # all — KnowledgeChunkConsumer.start() already retries internally and degrades to a loud
    # log rather than raising, so it's safe to fire-and-forget here.
    try:
        embedding_service = await get_embedding_service()
        chunking_service = await get_chunking_service(embedding_service, postgres_repo)
        knowledge_chunk_consumer = await get_knowledge_chunk_consumer(chunking_service)
        asyncio.create_task(knowledge_chunk_consumer.start())
        logger.info("Knowledge chunk-trigger consumer connect task scheduled")
    except Exception as e:
        logger.error(f"Failed to schedule knowledge chunk-trigger consumer: {e}", exc_info=True)

@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on application shutdown"""
    logger.info("Shutting down AI Agent Service...")
    try:
        consumer = await get_knowledge_chunk_consumer(await get_chunking_service(
            await get_embedding_service(), await get_postgres_repository()))
        await consumer.stop()
    except Exception as e:
        logger.warning(f"Error stopping knowledge chunk-trigger consumer: {e}")

# Include routers
app.include_router(chat.router)
app.include_router(knowledge.router)
app.include_router(search.router)
app.include_router(settings_router.router)

@app.get("/", response_model=HealthResponse)
async def root():
    """Root endpoint"""
    return HealthResponse(status=f"{settings.app_name} is running")

@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint"""
    return HealthResponse(status="healthy")

if __name__ == "__main__":
    import uvicorn
    
    uvicorn.run(
        "main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug
    )
