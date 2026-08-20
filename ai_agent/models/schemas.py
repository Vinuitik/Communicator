from pydantic import BaseModel
from typing import Literal, Optional, Dict, Any, List
from datetime import datetime
from dataclasses import dataclass
import numpy as np

class QueryInput(BaseModel):
    """Input schema for chat queries"""
    message: str

class SummarizeKnowledgeInput(BaseModel):
    """Input schema for knowledge summarization"""
    friend_id: int

class LLMModeUpdate(BaseModel):
    """Input schema for switching the LLM mode (local vs. cloud)"""
    mode: Literal["ollama", "cloud"]

class LLMProviderKeyUpdate(BaseModel):
    """Input schema for setting a cloud provider's API key"""
    api_key: str

class ChatResponse(BaseModel):
    """Response schema for chat endpoints"""
    response: Dict[str, Any]

class ErrorResponse(BaseModel):
    """Response schema for errors"""
    error: str
    details: Optional[str] = None

class WebSocketMessage(BaseModel):
    """Schema for WebSocket messages.

    `type` drives the client state machine:
      thinking     - agent/model started reasoning (show loading)
      token        - streamed delta of the final answer (append to bubble)
      tool_call    - agent decided to call a tool  (name + data=args)
      tool_result  - a tool returned              (name + data=result)
      trace        - raw LLM/agent output line, for debugging ("stir it")
      ai_response  - final complete answer (terminal, backward-compatible)
      error        - failure (content=message, data=detail/traceback)
    """
    type: str
    content: Optional[str] = None
    name: Optional[str] = None          # tool or model name
    data: Optional[Any] = None          # structured payload (args / result / detail)
    phase: Optional[str] = None         # optional sub-phase label

class HealthResponse(BaseModel):
    """Response schema for health check"""
    status: str

class MCPKnowledgeDTO(BaseModel):
    """Schema for MCP Knowledge DTO - corresponds to Java MCP_Knowledge_DTO"""
    id: Optional[int] = None
    fact: str
    importance: int

class ChunkDocument(BaseModel):
    """Schema for chunk document stored in Postgres (knowledge_chunks table).

    chunk_text is persisted here (unlike the old Mongo-only version, which
    reconstructed it on demand from char_start/char_end against the JVM's
    full knowledge text) because pg_search's BM25 index needs real text in
    a real column.

    source_type + exactly one of friend_id/group_id/(connection_friend1_id,
    connection_friend2_id) tags which JVM entity this chunk belongs to — same
    "exactly one subject" invariant as the JVM meeting module's Meeting
    entity. Enforced in ChunkingService.process_knowledge, not here (pydantic
    validation here would apply to the pre-migration/default-FRIEND shape too
    readily; the cross-field check belongs with the write path that owns it).
    """
    chunk_id: str
    knowledge_id: int  # Single FK - 1:1 relationship with knowledge
    chunk_index: int  # Position in original text (0, 1, 2...)
    chunk_text: str  # The chunk's actual text, for BM25 indexing
    word_count: int
    char_start: int  # Start position in original knowledge text
    char_end: int  # End position in original knowledge text
    text_hash: str  # MD5 hash of original knowledge text for invalidation detection
    created_at: datetime
    source_type: str = "FRIEND"  # FRIEND | GROUP | CONNECTION
    friend_id: Optional[int] = None
    group_id: Optional[int] = None
    connection_friend1_id: Optional[int] = None
    connection_friend2_id: Optional[int] = None


class ChunkKnowledgeInput(BaseModel):
    """Input schema for POST /knowledge/chunk — the eager chunk-trigger the
    JVM's Friend/Group/Connection KnowledgeService's fire (best-effort, after
    their own save commits) instead of relying on lazy chunking.
    """
    knowledge_id: int
    source_type: Literal["FRIEND", "GROUP", "CONNECTION"]
    friend_id: Optional[int] = None
    group_id: Optional[int] = None
    connection_friend1_id: Optional[int] = None
    connection_friend2_id: Optional[int] = None
    text: str


class SearchAllInput(BaseModel):
    """Input schema for POST /search — cross-entity hybrid search."""
    query: str
    top_k: Optional[int] = None

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

class KnowledgeRegenerationTrigger(BaseModel):
    """Emitted when a knowledge item's text changes and invalidates facts that
    referenced its old chunks.

    Consumed by the "Trigger Knowledge Regeneration" flow (not yet built).
    Emission is a direct in-process call today (see ChunkingService.
    _emit_regeneration_trigger) rather than a queue publish - RabbitMQ is
    provisioned in docker-compose but nothing in this codebase consumes from
    it yet, so there's no established pattern to plug a single trigger into.
    """
    knowledge_id: int
    changed_chunk_ids: List[str]  # old chunk_ids invalidated by the text change
    stale_fact_ids: List[str]
    stale_friend_ids: List[int]
    detected_at: datetime

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