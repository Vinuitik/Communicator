from pydantic import BaseModel
from typing import Optional, Dict, Any

class QueryInput(BaseModel):
    """Input schema for chat queries"""
    message: str

class SummarizeKnowledgeInput(BaseModel):
    """Input schema for knowledge summarization"""
    friend_id: int

class ChatResponse(BaseModel):
    """Response schema for chat endpoints"""
    response: Dict[str, Any]

class ErrorResponse(BaseModel):
    """Response schema for errors"""
    error: str
    details: Optional[str] = None

class WebSocketMessage(BaseModel):
    """Schema for WebSocket messages"""
    type: str
    content: str

class HealthResponse(BaseModel):
    """Response schema for health check"""
    status: str
