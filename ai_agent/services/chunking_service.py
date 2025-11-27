"""Chunking service for processing knowledge into chunks with embeddings.

This service handles the eager chunking of knowledge texts into overlapping segments,
generates embeddings for each chunk, and persists both chunk metadata and embeddings
to MongoDB for efficient retrieval.
"""
from typing import List, Optional, Tuple, Dict
import hashlib
import logging
from datetime import datetime, timezone

from config.settings import settings
from models.schemas import ChunkDocument, EmbeddingDocument
from .embedding_service import EmbeddingService
from repositories.chunk_repository import ChunkRepository
from repositories.embedding_repository import EmbeddingRepository

logger = logging.getLogger(__name__)


class ChunkingService:
    """Service for chunking knowledge texts and generating embeddings.
    
    Features:
    - Splits long texts into overlapping chunks (interleaving windows)
    - Skips chunking for short texts (keeps as single chunk)
    - Eagerly generates embeddings for all chunks
    - Delegates persistence to repositories (Single Responsibility)
    - Handles chunk invalidation when knowledge text changes
    """

    def __init__(
        self, 
        embedding_service: EmbeddingService, 
        chunk_repository: ChunkRepository,
        embedding_repository: EmbeddingRepository
    ):
        """Initialize the chunking service.
        
        Args:
            embedding_service: Service for generating embeddings
            chunk_repository: Repository for chunk persistence
            embedding_repository: Repository for embedding persistence
        """
        self.embedding_service = embedding_service
        self.chunk_repo = chunk_repository
        self.embedding_repo = embedding_repository
        
        # Load configuration
        self.chunk_size_words = settings.chunk_size_words
        self.chunk_overlap_words = settings.chunk_overlap_words
        self.min_chunk_size_words = settings.min_chunk_size_words
        self.chunking_mode = settings.chunking_mode
        
        logger.info(
            f"Initialized ChunkingService - "
            f"chunk_size={self.chunk_size_words}, "
            f"overlap={self.chunk_overlap_words}, "
            f"min_size={self.min_chunk_size_words}, "
            f"mode={self.chunking_mode}"
        )

    def _calculate_text_hash(self, text: str) -> str:
        """Calculate MD5 hash of text for change detection.
        
        Args:
            text: Knowledge text
            
        Returns:
            MD5 hash hex string
        """
        return hashlib.md5(text.encode('utf-8')).hexdigest()

    def _generate_chunk_id(self, knowledge_id: int, chunk_index: int, text_hash: str) -> str:
        """Generate unique chunk ID.
        
        Args:
            knowledge_id: ID of parent knowledge
            chunk_index: Index of chunk in sequence
            text_hash: Hash of original text
            
        Returns:
            Unique chunk identifier
        """
        return f"chunk_{knowledge_id}_{chunk_index}_{text_hash[:8]}"

    def _split_into_chunks(self, text: str) -> List[Tuple[str, int, int]]:
        """Split text into overlapping chunks using interleaving windows.
        
        Optimized: O(n) complexity by precomputing word positions instead of O(n²).
        
        Args:
            text: Text to chunk
            
        Returns:
            List of tuples (chunk_text, char_start, char_end)
        """
        words = text.split()
        total_words = len(words)
        
        # If text is too short, return as single chunk
        if total_words < self.min_chunk_size_words:
            logger.debug(f"Text too short ({total_words} words), keeping as single chunk")
            return [(text, 0, len(text))]
        
        # Precompute starting character position for each word - O(n)
        word_char_positions = []
        char_pos = 0
        for word in words:
            word_char_positions.append(char_pos)
            char_pos += len(word) + 1  # +1 for space after word
        
        chunks = []
        start_word = 0
        
        while start_word < total_words:
            # Calculate end word for this chunk
            end_word = min(start_word + self.chunk_size_words, total_words)
            
            # Extract chunk words
            chunk_words = words[start_word:end_word]
            chunk_text = ' '.join(chunk_words)
            
            # Get character positions from precomputed array - O(1)
            char_start = word_char_positions[start_word]
            
            # Calculate end position
            if end_word < total_words:
                # End is one char before the next word's start (to exclude trailing space)
                char_end = word_char_positions[end_word] - 1
            else:
                # Last chunk goes to end of text
                char_end = len(text)
            
            chunks.append((chunk_text, char_start, char_end))
            
            # Move to next chunk with overlap
            start_word += (self.chunk_size_words - self.chunk_overlap_words)
            
            # Break if we've processed all words
            if end_word >= total_words:
                break
        
        logger.debug(f"Split text into {len(chunks)} chunks (total {total_words} words)")
        return chunks

    async def process_knowledge(
        self, 
        knowledge_id: int, 
        knowledge_text: str,
        force_regenerate: bool = False
    ) -> List[str]:
        """Process knowledge text into chunks with embeddings.
        
        This is the main public method for chunking. It handles:
        1. Change detection (via text hash)
        2. Chunk regeneration if needed
        3. Embedding generation
        4. Persistence to MongoDB
        
        Args:
            knowledge_id: ID of the knowledge item
            knowledge_text: Full text of the knowledge
            force_regenerate: Force regeneration even if text unchanged
            
        Returns:
            List of chunk IDs created
        """
        logger.info("=" * 80)
        logger.info(f"CHUNKING SERVICE: Processing knowledge {knowledge_id}")
        logger.info("=" * 80)
        logger.info(f"Knowledge text length: {len(knowledge_text)} characters")
        logger.info(f"Force regenerate: {force_regenerate}")
        logger.info(f"Chunk size: {self.chunk_size_words} words")
        logger.info(f"Chunk overlap: {self.chunk_overlap_words} words")
        
        # Calculate text hash for change detection
        text_hash = self._calculate_text_hash(knowledge_text)
        
        # Check if chunks already exist and text hasn't changed
        if not force_regenerate:
            existing_chunks = await self.chunk_repo.find_chunks_by_knowledge_and_hash(
                knowledge_id, text_hash
            )
            
            if existing_chunks:
                chunk_ids = [chunk["chunk_id"] for chunk in existing_chunks]
                logger.info(f"✓✓✓ CACHE HIT: Knowledge {knowledge_id} unchanged, using {len(chunk_ids)} existing chunks")
                logger.info(f"Chunk IDs: {chunk_ids[:3]}..." if len(chunk_ids) > 3 else f"Chunk IDs: {chunk_ids}")
                logger.info("=" * 80)
                return chunk_ids
        
        # Delete old chunks and embeddings
        await self.chunk_repo.delete_chunks_and_embeddings(knowledge_id)
        
        # Split text into chunks
        logger.info(f"Splitting text into chunks...")
        chunk_tuples = self._split_into_chunks(knowledge_text)
        logger.info(f"Created {len(chunk_tuples)} chunks")
        
        # Create chunk documents
        chunk_docs, chunk_texts, chunk_ids = self.chunk_repo.create_chunk_documents(
            chunk_tuples, knowledge_id, text_hash, self._generate_chunk_id
        )
        
        # Persist chunk documents
        logger.info(f"Persisting {len(chunk_docs)} chunk documents to MongoDB...")
        await self.chunk_repo.save_chunks(chunk_docs)
        logger.info(f"✓ Persisted {len(chunk_docs)} chunk documents")
        
        # Generate embeddings for all chunks
        logger.info(f"Generating embeddings for {len(chunk_texts)} chunks...")
        logger.info(f"Sample chunk texts (first 2):")
        for idx, text in enumerate(chunk_texts[:2], 1):
            logger.info(f"  Chunk {idx}: '{text[:100]}...'")
        
        embeddings = await self.embedding_service.embed_texts(chunk_texts)
        logger.info(f"✓ Successfully generated {len(embeddings)} embeddings")
        
        # Create embedding documents
        embedding_dimension = self.embedding_service.get_embedding_dimension()
        embedding_model = settings.embedding_model
        embedding_docs = self.embedding_repo.create_embedding_documents(
            chunk_ids, embeddings, embedding_dimension, embedding_model
        )
        
        # Persist embedding documents
        logger.info(f"Persisting {len(embedding_docs)} embedding documents to MongoDB...")
        await self.embedding_repo.save_embeddings(embedding_docs)
        logger.info(f"✓ Persisted {len(embedding_docs)} embedding documents")
        
        logger.info("=" * 80)
        logger.info(f"✓✓✓ CHUNKING COMPLETED for knowledge {knowledge_id}")
        logger.info("=" * 80)
        logger.info(f"Total chunks created: {len(chunk_ids)}")
        logger.info(f"Chunk IDs: {chunk_ids[:3]}..." if len(chunk_ids) > 3 else f"Chunk IDs: {chunk_ids}")
        logger.info("=" * 80)
        
        return chunk_ids

    async def get_chunk_text(self, chunk_id: str, full_knowledge_text: str) -> str:
        """Reconstruct chunk text from original knowledge using stored positions.
        
        Args:
            chunk_id: ID of the chunk
            full_knowledge_text: Full text of the parent knowledge
            
        Returns:
            Reconstructed chunk text
        """
        # Fetch chunk metadata
        chunk_doc = await self.chunk_repo.find_chunk_by_id(chunk_id)
        
        if not chunk_doc:
            raise ValueError(f"Chunk {chunk_id} not found")
        
        # Extract text using stored positions
        char_start = chunk_doc["char_start"]
        char_end = chunk_doc["char_end"]
        
        return full_knowledge_text[char_start:char_end]

    async def delete_knowledge_chunks(self, knowledge_id: int) -> None:
        """Public method to delete all chunks for a knowledge item.
        
        Called when knowledge is deleted.
        
        Args:
            knowledge_id: ID of the knowledge item
        """
        await self.chunk_repo.delete_chunks_and_embeddings(knowledge_id)

    async def ensure_embeddings_exist(self, chunk_ids: List[str], knowledge_texts: Dict[int, str]) -> int:
        """Ensure embeddings exist for given chunks (lazy embedding generation).
        
        This method checks which chunks are missing embeddings and generates only those.
        Used in lazy chunking scenarios where chunks exist but embeddings might be missing.
        
        Args:
            chunk_ids: List of chunk IDs to check
            knowledge_texts: Map of knowledge_id -> full text (for reconstructing chunk text)
            
        Returns:
            Number of embeddings created
        """
        logger.info("=" * 80)
        logger.info("LAZY EMBEDDING: Ensuring embeddings exist for chunks")
        logger.info("=" * 80)
        logger.info(f"Checking {len(chunk_ids)} chunks for embeddings")
        
        # Find chunks missing embeddings
        missing_chunk_ids = await self.chunk_repo.find_chunks_missing_embeddings(chunk_ids)
        
        existing_count = len(chunk_ids) - len(missing_chunk_ids)
        logger.info(f"Found {existing_count} chunks with existing embeddings")
        
        if not missing_chunk_ids:
            logger.info("✓ All chunks already have embeddings")
            logger.info("=" * 80)
            return 0
        
        logger.info(f"Need to generate embeddings for {len(missing_chunk_ids)} chunks")
        
        # Fetch chunk metadata to reconstruct texts
        chunk_docs = await self.chunk_repo.find_chunks_by_ids(missing_chunk_ids)
        
        # Reconstruct chunk texts
        chunk_texts = []
        chunk_ids_ordered = []
        
        for chunk_doc in chunk_docs:
            knowledge_id = chunk_doc["knowledge_id"]
            full_text = knowledge_texts.get(knowledge_id)
            
            if not full_text:
                logger.warning(f"Missing knowledge text for knowledge_id {knowledge_id}, skipping chunk {chunk_doc['chunk_id']}")
                continue
            
            # Reconstruct chunk text from positions
            char_start = chunk_doc["char_start"]
            char_end = chunk_doc["char_end"]
            chunk_text = full_text[char_start:char_end]
            
            chunk_texts.append(chunk_text)
            chunk_ids_ordered.append(chunk_doc["chunk_id"])
        
        if not chunk_texts:
            logger.warning("No chunk texts to embed")
            return 0
        
        logger.info(f"Generating embeddings for {len(chunk_texts)} chunks...")
        
        # Generate embeddings
        embeddings = await self.embedding_service.embed_texts(chunk_texts)
        logger.info(f"✓ Generated {len(embeddings)} embeddings")
        
        # Create embedding documents
        embedding_dimension = self.embedding_service.get_embedding_dimension()
        embedding_model = settings.embedding_model
        embedding_docs = self.embedding_repo.create_embedding_documents(
            chunk_ids_ordered, embeddings, embedding_dimension, embedding_model
        )
        
        # Persist embeddings
        logger.info(f"Persisting {len(embedding_docs)} embeddings to MongoDB...")
        await self.embedding_repo.save_embeddings(embedding_docs)
        logger.info(f"✓ Persisted {len(embedding_docs)} embeddings")
        logger.info("=" * 80)
        
        return len(embedding_docs)

    async def get_chunk_count(self, knowledge_id: int) -> int:
        """Get the number of chunks for a knowledge item.
        
        Args:
            knowledge_id: ID of the knowledge item
            
        Returns:
            Number of chunks
        """
        return await self.chunk_repo.count_chunks_by_knowledge_id(knowledge_id)
