"""Repository for managing embedding data in MongoDB.

This repository encapsulates all database operations related to embeddings,
following the Single Responsibility Principle and repository pattern.
"""
from typing import List, Optional, Dict
import logging

from models.schemas import EmbeddingDocument

logger = logging.getLogger(__name__)


class EmbeddingRepository:
    """Repository for embedding persistence operations.
    
    Responsibilities:
    - CRUD operations for embedding documents
    - Batch operations for efficiency
    - Query operations for finding embeddings by various criteria
    """

    def __init__(self, mongo_repo):
        """Initialize the embedding repository.
        
        Args:
            mongo_repo: MongoDB repository instance
        """
        self.mongo_repo = mongo_repo
        self.embeddings_collection = "chunk_embeddings"

    async def save_embeddings(self, embedding_docs: List[EmbeddingDocument]) -> int:
        """Save multiple embedding documents to MongoDB.
        
        Args:
            embedding_docs: List of embedding documents to save
            
        Returns:
            Number of embeddings saved
        """
        if not embedding_docs:
            return 0
        
        logger.debug(f"Saving {len(embedding_docs)} embedding documents to '{self.embeddings_collection}'")
        await self.mongo_repo.insert_many(
            self.embeddings_collection,
            [doc.dict() for doc in embedding_docs]
        )
        logger.debug(f"✓ Saved {len(embedding_docs)} embedding documents")
        return len(embedding_docs)

    async def find_embeddings_by_chunk_ids(self, chunk_ids: List[str]) -> List[Dict]:
        """Find embeddings for multiple chunks.
        
        Args:
            chunk_ids: List of chunk IDs
            
        Returns:
            List of embedding documents
        """
        if not chunk_ids:
            return []
        
        embeddings = await self.mongo_repo.find_many(
            self.embeddings_collection,
            {"chunk_id": {"$in": chunk_ids}}
        )
        return embeddings or []

    async def find_embedding_by_chunk_id(self, chunk_id: str) -> Optional[Dict]:
        """Find embedding for a single chunk.
        
        Args:
            chunk_id: ID of the chunk
            
        Returns:
            Embedding document or None if not found
        """
        return await self.mongo_repo.find_one(
            self.embeddings_collection,
            {"chunk_id": chunk_id}
        )

    async def delete_embeddings_by_chunk_ids(self, chunk_ids: List[str]) -> int:
        """Delete embeddings for multiple chunks.
        
        Args:
            chunk_ids: List of chunk IDs
            
        Returns:
            Number of embeddings deleted
        """
        if not chunk_ids:
            return 0
        
        logger.debug(f"Deleting embeddings for {len(chunk_ids)} chunks")
        await self.mongo_repo.delete_many(
            self.embeddings_collection,
            {"chunk_id": {"$in": chunk_ids}}
        )
        logger.debug(f"✓ Deleted embeddings for {len(chunk_ids)} chunks")
        return len(chunk_ids)

    async def find_chunks_missing_embeddings(self, chunk_ids: List[str]) -> List[str]:
        """Find which chunks are missing embeddings.
        
        Args:
            chunk_ids: List of chunk IDs to check
            
        Returns:
            List of chunk IDs that don't have embeddings
        """
        if not chunk_ids:
            return []
        
        # Find existing embeddings
        existing_embeddings = await self.find_embeddings_by_chunk_ids(chunk_ids)
        existing_chunk_ids = {doc["chunk_id"] for doc in existing_embeddings}
        
        # Find missing ones
        missing = [cid for cid in chunk_ids if cid not in existing_chunk_ids]
        
        if missing:
            logger.debug(f"Found {len(missing)} chunks missing embeddings out of {len(chunk_ids)}")
        
        return missing

    async def count_embeddings_by_chunk_ids(self, chunk_ids: List[str]) -> int:
        """Count embeddings for a list of chunk IDs.
        
        Args:
            chunk_ids: List of chunk IDs
            
        Returns:
            Number of embeddings found
        """
        if not chunk_ids:
            return 0
        
        embeddings = await self.find_embeddings_by_chunk_ids(chunk_ids)
        return len(embeddings)

    def create_embedding_documents(
        self,
        chunk_ids: List[str],
        embeddings: List[List[float]],
        embedding_dimension: int,
        embedding_model: str
    ) -> List[EmbeddingDocument]:
        """Create embedding documents from embeddings.
        
        Args:
            chunk_ids: List of chunk IDs
            embeddings: List of embedding vectors
            embedding_dimension: Dimension of embedding vectors
            embedding_model: Name of the embedding model
            
        Returns:
            List of embedding documents
        """
        from datetime import datetime, timezone
        
        embedding_docs = []
        
        for chunk_id, embedding in zip(chunk_ids, embeddings):
            embedding_doc = EmbeddingDocument(
                chunk_id=chunk_id,
                embedding=embedding,
                model_name=embedding_model,
                dimension=embedding_dimension,
                created_at=datetime.now(timezone.utc)
            )
            embedding_docs.append(embedding_doc)
        
        return embedding_docs
