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
    """Schema for chunk document stored in MongoDB - contains only metadata, no text"""
    chunk_id: str
    knowledge_id: int  # Single FK - 1:1 relationship with knowledge
    chunk_index: int  # Position in original text (0, 1, 2...)
    word_count: int
    char_start: int  # Start position in original knowledge text
    char_end: int  # End position in original knowledge text
    text_hash: str  # MD5 hash of original knowledge text for invalidation detection
    created_at: datetime

class EmbeddingDocument(BaseModel):
    """Schema for embedding document stored in MongoDB"""
    chunk_id: str  # One-to-one relationship with chunk
    embedding: List[float]  # Stored as list for JSON serialization
    model_name: str
    dimension: int
    created_at: datetime

class FactReferenceDocument(BaseModel):
    """Schema for fact-to-chunk reference stored in MongoDB"""
    fact_id: str  # FK to friend_summaries.facts[].fact_id (ObjectId as string)
    chunk_id: str  # FK to knowledge_chunks.chunk_id
    knowledge_id: int  # Denormalized for performance
    friend_id: int  # Denormalized for filtering
    relevance_score: float  # Cosine similarity (0.0 to 1.0)
    validated: bool  # AI confirmed this reference
    validation_confidence: Optional[float] = None
    created_at: datetime
    rank: int  # 1=strongest, 2=second, 3=third

class FactDocument(BaseModel):
    """Schema for individual fact stored in friend_summaries.facts array"""
    fact_id: str  # Unique identifier (ObjectId as string)
    key: str  # Fact category/key
    value: str  # Fact value
    stability_score: float  # Confidence score (0.0 - 1.0)
    validated: bool  # AI validation status
    created_at: datetime
    updated_at: datetime

class FriendSummaryDocument(BaseModel):
    """Schema for friend summary document with structured facts"""
    friend_id: int
    facts: List[FactDocument]
    last_updated: datetime
    fact_count: int

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