from pydantic import BaseModel
from typing import Optional, Dict, Any, List
from datetime import datetime
from dataclasses import dataclass
import numpy as np

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

class MCPKnowledgeDTO(BaseModel):
    """Schema for MCP Knowledge DTO - corresponds to Java MCP_Knowledge_DTO"""
    id: Optional[int] = None
    fact: str
    importance: int

class ChunkDocument(BaseModel):
    """Schema for chunk document stored in MongoDB"""
    chunk_id: str
    text: str
    word_count: int
    char_start: int
    char_end: int
    knowledge_ids: List[int]  # Many-to-many: list of knowledge IDs that reference this chunk
    created_at: datetime
    updated_at: datetime

class EmbeddingDocument(BaseModel):
    """Schema for embedding document stored in MongoDB"""
    chunk_id: str  # One-to-one relationship with chunk
    embedding: List[float]  # Stored as list for JSON serialization
    model_name: str
    dimension: int
    created_at: datetime

@dataclass
class CitationResult:
    """Data class for citation results"""
    source_text: str
    source_metadata: Dict[str, Any]
    confidence_score: float
    chunk_id: str
    
@dataclass
class ChunkData:
    """Data class for document chunks - used in memory during processing"""
    text: str
    metadata: Dict[str, Any]
    chunk_id: str
    knowledge_ids: List[int]  # Track which knowledge items this chunk came from
    embedding: Optional[np.ndarray] = None