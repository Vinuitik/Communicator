from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import chat, knowledge
from models.schemas import HealthResponse
from dependencies.deps import get_agent_service
from config.settings import settings
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
    
    # Initialize the agent service (this will trigger all dependencies)
    try:
        logger.info("Initializing agent service and dependencies...")
        agent_service = await get_agent_service()
        logger.info("AI Agent Service started successfully")
        logger.info(f"Agent service instance: {agent_service}")
    except Exception as e:
        logger.error(f"Failed to start AI Agent Service: {e}", exc_info=True)
        raise

@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on application shutdown"""
    logger.info("Shutting down AI Agent Service...")

# Include routers
app.include_router(chat.router)
app.include_router(knowledge.router)

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
