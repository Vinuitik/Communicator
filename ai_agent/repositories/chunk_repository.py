"""Repository for managing chunk data in MongoDB.

This repository encapsulates all database operations related to chunks only,
following the Single Responsibility Principle and repository pattern.
"""
from typing import List, Optional, Dict
import logging

from models.schemas import ChunkDocument
from .embedding_repository import EmbeddingRepository

logger = logging.getLogger(__name__)


class ChunkRepository:
    """Repository for chunk persistence operations.
    
    Responsibilities:
    - CRUD operations for chunk documents
    - Batch operations for efficiency
    - Query operations for finding chunks by various criteria
    - Coordinates with EmbeddingRepository for related operations
    """

    def __init__(self, mongo_repo, embedding_repository: EmbeddingRepository):
        """Initialize the chunk repository.
        
        Args:
            mongo_repo: MongoDB repository instance
            embedding_repository: Repository for embedding operations
        """
        self.mongo_repo = mongo_repo
        self.embedding_repo = embedding_repository
        self.chunks_collection = "knowledge_chunks"

    # ============================================================================
    # Chunk Document Operations
    # ============================================================================

    async def save_chunks(self, chunk_docs: List[ChunkDocument]) -> int:
        """Save multiple chunk documents to MongoDB.
        
        Args:
            chunk_docs: List of chunk documents to save
            
        Returns:
            Number of chunks saved
        """
        if not chunk_docs:
            return 0
        
        logger.debug(f"Saving {len(chunk_docs)} chunk documents to '{self.chunks_collection}'")
        await self.mongo_repo.insert_many(
            self.chunks_collection,
            [doc.dict() for doc in chunk_docs]
        )
        logger.debug(f"✓ Saved {len(chunk_docs)} chunk documents")
        return len(chunk_docs)

    async def find_chunks_by_knowledge_id(self, knowledge_id: int) -> List[Dict]:
        """Find all chunks for a knowledge item.
        
        Args:
            knowledge_id: ID of the knowledge item
            
        Returns:
            List of chunk documents
        """
        chunks = await self.mongo_repo.find_many(
            self.chunks_collection,
            {"knowledge_id": knowledge_id}
        )
        return chunks or []

    async def find_chunks_by_knowledge_and_hash(
        self, 
        knowledge_id: int, 
        text_hash: str
    ) -> List[Dict]:
        """Find chunks for a knowledge item with a specific text hash.
        
        Used for cache validation - if chunks exist with same hash, text hasn't changed.
        
        Args:
            knowledge_id: ID of the knowledge item
            text_hash: Hash of the knowledge text
            
        Returns:
            List of chunk documents
        """
        chunks = await self.mongo_repo.find_many(
            self.chunks_collection,
            {"knowledge_id": knowledge_id, "text_hash": text_hash}
        )
        return chunks or []

    async def find_chunk_by_id(self, chunk_id: str) -> Optional[Dict]:
        """Find a single chunk by its ID.
        
        Args:
            chunk_id: ID of the chunk
            
        Returns:
            Chunk document or None if not found
        """
        return await self.mongo_repo.find_one(
            self.chunks_collection,
            {"chunk_id": chunk_id}
        )

    async def find_chunks_by_ids(self, chunk_ids: List[str]) -> List[Dict]:
        """Find multiple chunks by their IDs.
        
        Args:
            chunk_ids: List of chunk IDs
            
        Returns:
            List of chunk documents
        """
        if not chunk_ids:
            return []
        
        chunks = await self.mongo_repo.find_many(
            self.chunks_collection,
            {"chunk_id": {"$in": chunk_ids}}
        )
        return chunks or []

    async def delete_chunks_by_knowledge_id(self, knowledge_id: int) -> int:
        """Delete all chunks for a knowledge item.
        
        Args:
            knowledge_id: ID of the knowledge item
            
        Returns:
            Number of chunks deleted
        """
        # Get chunk count before deletion
        chunks = await self.find_chunks_by_knowledge_id(knowledge_id)
        count = len(chunks)
        
        if count == 0:
            logger.debug(f"No chunks to delete for knowledge {knowledge_id}")
            return 0
        
        logger.debug(f"Deleting {count} chunks for knowledge {knowledge_id}")
        await self.mongo_repo.delete_many(
            self.chunks_collection,
            {"knowledge_id": knowledge_id}
        )
        logger.debug(f"✓ Deleted {count} chunks")
        return count

    async def count_chunks_by_knowledge_id(self, knowledge_id: int) -> int:
        """Count chunks for a knowledge item.
        
        Args:
            knowledge_id: ID of the knowledge item
            
        Returns:
            Number of chunks
        """
        count = await self.mongo_repo.count_documents(
            self.chunks_collection,
            {"knowledge_id": knowledge_id}
        )
        return count

    def create_chunk_documents(
        self,
        chunk_tuples: List[tuple],
        knowledge_id: int,
        text_hash: str,
        chunk_id_generator
    ) -> tuple:
        """Create chunk documents from chunk tuples.
        
        Args:
            chunk_tuples: List of (chunk_text, char_start, char_end) tuples
            knowledge_id: ID of parent knowledge
            text_hash: Hash of original text
            chunk_id_generator: Function to generate chunk IDs (knowledge_id, chunk_index, text_hash) -> str
            
        Returns:
            Tuple of (chunk_docs, chunk_texts, chunk_ids)
        """
        from datetime import datetime, timezone
        
        chunk_docs = []
        chunk_texts = []
        chunk_ids = []
        
        for chunk_index, (chunk_text, char_start, char_end) in enumerate(chunk_tuples):
            chunk_id = chunk_id_generator(knowledge_id, chunk_index, text_hash)
            
            chunk_doc = ChunkDocument(
                chunk_id=chunk_id,
                knowledge_id=knowledge_id,
                chunk_index=chunk_index,
                word_count=len(chunk_text.split()),
                char_start=char_start,
                char_end=char_end,
                text_hash=text_hash,
                created_at=datetime.now(timezone.utc)
            )
            
            chunk_docs.append(chunk_doc)
            chunk_texts.append(chunk_text)
            chunk_ids.append(chunk_id)
        
        return chunk_docs, chunk_texts, chunk_ids

    # ============================================================================
    # Combined Operations (Coordinates with EmbeddingRepository)
    # ============================================================================

    async def delete_chunks_and_embeddings(self, knowledge_id: int) -> Dict[str, int]:
        """Delete all chunks and their embeddings for a knowledge item.
        
        This is a convenience method that performs both operations atomically.
        
        Args:
            knowledge_id: ID of the knowledge item
            
        Returns:
            Dictionary with counts: {"chunks": int, "embeddings": int}
        """
        # Get all chunk IDs first
        chunks = await self.find_chunks_by_knowledge_id(knowledge_id)
        chunk_ids = [chunk["chunk_id"] for chunk in chunks]
        
        if not chunk_ids:
            logger.debug(f"No chunks found for knowledge {knowledge_id}")
            return {"chunks": 0, "embeddings": 0}
        
        logger.debug(f"Deleting {len(chunk_ids)} chunks and embeddings for knowledge {knowledge_id}")
        
        # Delete embeddings first (foreign key pattern)
        embeddings_deleted = await self.embedding_repo.delete_embeddings_by_chunk_ids(chunk_ids)
        
        # Then delete chunks
        chunks_deleted = await self.delete_chunks_by_knowledge_id(knowledge_id)
        
        logger.debug(f"✓ Deleted {chunks_deleted} chunks and {embeddings_deleted} embeddings")
        return {"chunks": chunks_deleted, "embeddings": embeddings_deleted}

    async def find_chunks_missing_embeddings(self, chunk_ids: List[str]) -> List[str]:
        """Find which chunks are missing embeddings.
        
        Delegates to EmbeddingRepository for the actual check.
        
        Args:
            chunk_ids: List of chunk IDs to check
            
        Returns:
            List of chunk IDs that don't have embeddings
        """
        return await self.embedding_repo.find_chunks_missing_embeddings(chunk_ids)

    async def get_statistics(self, knowledge_id: int) -> Dict[str, int]:
        """Get statistics about chunks and embeddings for a knowledge item.
        
        Args:
            knowledge_id: ID of the knowledge item
            
        Returns:
            Dictionary with statistics
        """
        chunks = await self.find_chunks_by_knowledge_id(knowledge_id)
        chunk_ids = [chunk["chunk_id"] for chunk in chunks]
        
        embedding_count = await self.embedding_repo.count_embeddings_by_chunk_ids(chunk_ids)
        
        return {
            "total_chunks": len(chunks),
            "total_embeddings": embedding_count,
            "missing_embeddings": len(chunk_ids) - embedding_count
        }
