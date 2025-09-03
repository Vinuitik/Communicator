from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import chat, knowledge
from models.schemas import HealthResponse
from dependencies.deps import get_agent_service

# Create FastAPI application
app = FastAPI(
    title="AI Agent Service",
    description="A conversational AI agent service with knowledge integration",
    version="1.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify your frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup_event():
    """Initialize services on application startup"""
    print("Starting AI Agent Service...")
    
    # Initialize the agent service (this will trigger all dependencies)
    try:
        agent_service = await get_agent_service()
        print("AI Agent Service started successfully")
    except Exception as e:
        print(f"Failed to start AI Agent Service: {e}")
        raise

@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on application shutdown"""
    print("Shutting down AI Agent Service...")

# Include routers
app.include_router(chat.router)
app.include_router(knowledge.router)

@app.get("/", response_model=HealthResponse)
async def root():
    """Root endpoint"""
    return HealthResponse(status="AI Agent Service is running")

@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint"""
    return HealthResponse(status="healthy")

if __name__ == "__main__":
    import uvicorn
    from .config.settings import settings
    
    uvicorn.run(
        "main:app",
        host=settings.host,
        port=settings.port,
        reload=True
    )
