from typing import Dict, Any, List, Optional, Tuple
import json
import logging
import hashlib
import numpy as np
from dataclasses import dataclass
from datetime import datetime, timezone

# LlamaIndex imports
from llama_index.core import Document
from llama_index.core.text_splitter import SentenceSplitter
from llama_index.core.schema import TextNode

# FAISS and embedding imports
import faiss
from sentence_transformers import SentenceTransformer

# Local imports
from .agent_service import AgentService
from config.settings import settings

from models.schemas import CitationResult, ChunkData, MCPKnowledgeDTO, ChunkDocument, EmbeddingDocument

# Set up logger
logger = logging.getLogger(__name__)



class CitationService:
    """Service for finding citations and sources for facts using RAG approach"""
    
    def __init__(self, agent_service: AgentService, redis_repo=None, mongo_repo=None):
        """
        Initialize Citation Service
        
        Args:
            agent_service: Agent service for LLM operations
            redis_repo: Redis repository for caching
            mongo_repo: MongoDB repository for persistent storage
        """
        self.agent_service = agent_service
        self.redis_repo = redis_repo
        self.mongo_repo = mongo_repo
        
        # Initialize embedding model
        self.embedding_model = SentenceTransformer('all-MiniLM-L6-v2')
        
        # Initialize text splitter
        self.text_splitter = SentenceSplitter(
            chunk_size=settings.citation_chunk_size,
            chunk_overlap=settings.citation_chunk_overlap
        )
        
        # FAISS index (will be built dynamically)
        self.faiss_index = None
        self.chunk_store: List[ChunkData] = []
        
        logger.info("CitationService initialized")
    
    async def obtain_source(self, fact: str, sources: List[MCPKnowledgeDTO]) -> List[CitationResult]:
        """
        Main public method to find citations for a given fact from provided sources
        
        Args:
            fact: The statement/fact to find citations for
            sources: List of MCPKnowledgeDTO objects to search through
            
        Returns:
            List of CitationResult objects with source attributions
        """
        logger.info(f"Finding citations for fact: '{fact[:100]}...' from {len(sources)} knowledge sources")
        
        try:
            # Step 1: Process and chunk all sources
            all_chunks = await self._process_sources(sources)
            logger.info(f"Generated {len(all_chunks)} chunks from sources")
            
            # Step 2: Generate/retrieve embeddings for all chunks
            await self._ensure_embeddings(all_chunks)
            
            # Step 3: Build FAISS index with current chunks
            self._build_faiss_index(all_chunks)
            
            # Step 4: Search for relevant chunks
            relevant_chunks = await self._search_similar_chunks(fact, top_k=5)
            
            # Step 5: Format results as citations
            citations = self._format_citations(relevant_chunks)
            
            logger.info(f"Found {len(citations)} relevant citations")
            return citations
            
        except Exception as e:
            logger.error(f"Error in obtain_source: {str(e)}", exc_info=True)
            raise RuntimeError(f"Error finding citations: {str(e)}")
    
    async def _process_sources(self, sources: List[MCPKnowledgeDTO]) -> List[ChunkData]:
        """
        Process source documents into chunks using LlamaIndex
        
        Args:
            sources: List of MCPKnowledgeDTO objects
            
        Returns:
            List of ChunkData objects
        """
        logger.debug(f"Processing {len(sources)} knowledge sources into chunks")
        all_chunks = []
        
        for idx, knowledge_dto in enumerate(sources):
            source_text = knowledge_dto.fact
            knowledge_id = knowledge_dto.id
            
            # Skip sources without valid IDs
            if knowledge_id is None:
                logger.warning(f"Knowledge source {idx} has no ID, skipping")
                continue
            
            # Skip very small sources (less than 60 words as per your requirement)
            if len(source_text.split()) < 60:
                logger.debug(f"Knowledge {knowledge_id} too small ({len(source_text.split())} words), keeping as single chunk")
                chunk_id = self._generate_chunk_id(source_text, [knowledge_id], 0)
                chunk_data = ChunkData(
                    text=source_text,
                    metadata={
                        "chunk_index": 0,
                        "total_chunks": 1,
                        "word_count": len(source_text.split()),
                        "char_start": 0,
                        "char_end": len(source_text),
                        "importance": knowledge_dto.importance
                    },
                    chunk_id=chunk_id,
                    knowledge_ids=[knowledge_id]
                )
                all_chunks.append(chunk_data)
                continue
            
            # Create LlamaIndex document
            document = Document(
                text=source_text, 
                metadata={
                    "knowledge_id": knowledge_id,
                    "importance": knowledge_dto.importance
                }
            )
            
            # Split into chunks
            nodes = self.text_splitter.get_nodes_from_documents([document])
            
            logger.debug(f"Knowledge {knowledge_id} split into {len(nodes)} chunks")
            
            # Convert nodes to ChunkData
            for chunk_idx, node in enumerate(nodes):
                chunk_id = self._generate_chunk_id(node.text, [knowledge_id], chunk_idx)
                chunk_data = ChunkData(
                    text=node.text,
                    metadata={
                        "chunk_index": chunk_idx,
                        "total_chunks": len(nodes),
                        "word_count": len(node.text.split()),
                        "char_start": getattr(node, 'start_char_idx', 0),
                        "char_end": getattr(node, 'end_char_idx', len(node.text)),
                        "importance": knowledge_dto.importance
                    },
                    chunk_id=chunk_id,
                    knowledge_ids=[knowledge_id]
                )
                all_chunks.append(chunk_data)
        
        logger.debug(f"Total chunks generated: {len(all_chunks)}")
        return all_chunks
    
    def _generate_chunk_id(self, text: str, knowledge_ids: List[int], chunk_idx: int) -> str:
        """Generate unique chunk ID based on content and knowledge IDs"""
        content_hash = hashlib.md5(text.encode()).hexdigest()[:8]
        knowledge_ids_str = "_".join(map(str, sorted(knowledge_ids)))
        return f"chunk_{knowledge_ids_str}_{chunk_idx}_{content_hash}"
    
    async def _ensure_embeddings(self, chunks: List[ChunkData]) -> None:
        """
        Generate embeddings for chunks, using cache when possible
        
        Args:
            chunks: List of ChunkData objects to generate embeddings for
        """
        logger.debug(f"Ensuring embeddings for {len(chunks)} chunks")
        
        chunks_to_embed = []
        
        for chunk in chunks:
            # First, check if we can reuse an existing chunk from database
            existing_chunk = await self._get_or_create_chunk(chunk)
            
            # Check if embedding already exists
            cached_embedding = await self._get_cached_embedding(chunk.chunk_id)
            
            if cached_embedding is not None:
                logger.debug(f"Using cached embedding for chunk {chunk.chunk_id}")
                chunk.embedding = cached_embedding
            else:
                logger.debug(f"Need to generate embedding for chunk {chunk.chunk_id}")
                chunks_to_embed.append(chunk)
        
        # Generate embeddings for chunks that don't have them
        if chunks_to_embed:
            logger.info(f"Generating embeddings for {len(chunks_to_embed)} chunks")
            texts = [chunk.text for chunk in chunks_to_embed]
            embeddings = self.embedding_model.encode(texts, convert_to_numpy=True)
            
            # Assign embeddings and cache them
            for chunk, embedding in zip(chunks_to_embed, embeddings):
                chunk.embedding = embedding
                await self._cache_embedding(chunk.chunk_id, embedding)
    
    async def _get_or_create_chunk(self, chunk_data: ChunkData) -> Optional[ChunkDocument]:
        """
        Get existing chunk from database or create a new one if it doesn't exist
        Handles many-to-many relationship between chunks and knowledge items
        
        Args:
            chunk_data: ChunkData object to find or create
            
        Returns:
            ChunkDocument from database
        """
        if not self.mongo_repo:
            return None
        
        try:
            # Check if chunk with same text already exists
            content_hash = hashlib.md5(chunk_data.text.encode()).hexdigest()
            existing_chunk = await self.mongo_repo.find_one(
                "chunks",
                {"text": chunk_data.text}  # Find by exact text match
            )
            
            current_time = datetime.now(timezone.utc)
            
            if existing_chunk:
                # Update existing chunk to include new knowledge IDs
                existing_knowledge_ids = set(existing_chunk.get("knowledge_ids", []))
                new_knowledge_ids = set(chunk_data.knowledge_ids)
                updated_knowledge_ids = list(existing_knowledge_ids.union(new_knowledge_ids))
                
                # Update the chunk with new knowledge IDs
                await self.mongo_repo.update_one(
                    "chunks",
                    {"_id": existing_chunk["_id"]},
                    {
                        "$set": {
                            "knowledge_ids": updated_knowledge_ids,
                            "updated_at": current_time
                        }
                    }
                )
                
                logger.debug(f"Updated existing chunk {chunk_data.chunk_id} with knowledge IDs: {new_knowledge_ids}")
                
                # Update chunk_data to use existing chunk_id for consistency
                chunk_data.chunk_id = existing_chunk["chunk_id"]
                chunk_data.knowledge_ids = updated_knowledge_ids
                
                return ChunkDocument(**existing_chunk)
            else:
                # Create new chunk document
                chunk_doc = ChunkDocument(
                    chunk_id=chunk_data.chunk_id,
                    text=chunk_data.text,
                    word_count=chunk_data.metadata.get("word_count", len(chunk_data.text.split())),
                    char_start=chunk_data.metadata.get("char_start", 0),
                    char_end=chunk_data.metadata.get("char_end", len(chunk_data.text)),
                    knowledge_ids=chunk_data.knowledge_ids,
                    created_at=current_time,
                    updated_at=current_time
                )
                
                # Insert into database
                await self.mongo_repo.insert_one("chunks", chunk_doc.dict())
                
                logger.debug(f"Created new chunk {chunk_data.chunk_id} for knowledge IDs: {chunk_data.knowledge_ids}")
                return chunk_doc
                
        except Exception as e:
            logger.warning(f"Error handling chunk {chunk_data.chunk_id}: {str(e)}")
            return None
    
    async def _get_cached_embedding(self, chunk_id: str) -> Optional[np.ndarray]:
        """
        Retrieve cached embedding from database
        
        Args:
            chunk_id: Unique identifier for the chunk
            
        Returns:
            Cached embedding array or None if not found
        """
        if not self.mongo_repo:
            return None
        
        try:
            cached_doc = await self.mongo_repo.find_one(
                "embeddings",
                {"chunk_id": chunk_id}
            )
            
            if cached_doc and "embedding" in cached_doc:
                # Convert back to numpy array
                embedding_list = cached_doc["embedding"]
                return np.array(embedding_list, dtype=np.float32)
            
        except Exception as e:
            logger.warning(f"Error retrieving cached embedding for {chunk_id}: {str(e)}")
        
        return None
    
    async def _cache_embedding(self, chunk_id: str, embedding: np.ndarray) -> None:
        """
        Cache embedding in database - separate from chunk storage
        
        Args:
            chunk_id: Unique identifier for the chunk
            embedding: Embedding array to cache
        """
        if not self.mongo_repo:
            return
        
        try:
            embedding_doc = EmbeddingDocument(
                chunk_id=chunk_id,
                embedding=embedding.tolist(),  # Convert to list for JSON serialization
                model_name="all-MiniLM-L6-v2",
                dimension=len(embedding),
                created_at=datetime.now(timezone.utc)
            )
            
            # Use upsert to avoid duplicates
            await self.mongo_repo.update_one(
                "embeddings",
                {"chunk_id": chunk_id},
                {"$set": embedding_doc.dict()},
                upsert=True
            )
            
            logger.debug(f"Cached embedding for chunk {chunk_id}")
            
        except Exception as e:
            logger.warning(f"Error caching embedding for {chunk_id}: {str(e)}")
    
    def _build_faiss_index(self, chunks: List[ChunkData]) -> None:
        """
        Build FAISS index from chunk embeddings
        
        Args:
            chunks: List of ChunkData objects with embeddings
        """
        logger.debug(f"Building FAISS index for {len(chunks)} chunks")
        
        # Extract embeddings
        embeddings = []
        valid_chunks = []
        
        for chunk in chunks:
            if chunk.embedding is not None:
                embeddings.append(chunk.embedding)
                valid_chunks.append(chunk)
            else:
                logger.warning(f"Chunk {chunk.chunk_id} has no embedding, skipping")
        
        if not embeddings:
            logger.error("No valid embeddings found, cannot build FAISS index")
            raise ValueError("No valid embeddings found")
        
        # Convert to numpy array
        embedding_matrix = np.array(embeddings, dtype=np.float32)
        
        # Create FAISS index (using L2 distance)
        dimension = embedding_matrix.shape[1]
        self.faiss_index = faiss.IndexFlatL2(dimension)
        
        # Add embeddings to index
        self.faiss_index.add(embedding_matrix)
        
        # Update chunk store
        self.chunk_store = valid_chunks
        
        logger.info(f"Built FAISS index with {len(valid_chunks)} chunks, dimension {dimension}")
    
    async def _search_similar_chunks(self, query_text: str, top_k: int = 5) -> List[Tuple[ChunkData, float]]:
        """
        Search for similar chunks using FAISS
        
        Args:
            query_text: Text to search for
            top_k: Number of top results to return
            
        Returns:
            List of tuples (ChunkData, similarity_score)
        """
        logger.debug(f"Searching for similar chunks to: '{query_text[:100]}...'")
        
        if self.faiss_index is None:
            raise ValueError("FAISS index not built")
        
        # Generate embedding for query
        query_embedding = self.embedding_model.encode([query_text], convert_to_numpy=True)
        
        # Search in FAISS index
        distances, indices = self.faiss_index.search(query_embedding, top_k)
        
        # Convert distances to similarity scores (lower distance = higher similarity)
        # Using inverse distance as similarity score
        results = []
        for distance, idx in zip(distances[0], indices[0]):
            if idx < len(self.chunk_store):
                chunk = self.chunk_store[idx]
                # Convert L2 distance to similarity score (0-1 range)
                similarity_score = 1.0 / (1.0 + distance)
                results.append((chunk, similarity_score))
        
        logger.debug(f"Found {len(results)} similar chunks")
        return results
    
    def _format_citations(self, similar_chunks: List[Tuple[ChunkData, float]]) -> List[CitationResult]:
        """
        Format search results as citation objects
        
        Args:
            similar_chunks: List of (ChunkData, similarity_score) tuples
            
        Returns:
            List of CitationResult objects
        """
        logger.debug(f"Formatting {len(similar_chunks)} chunks as citations")
        
        citations = []
        for chunk_data, similarity_score in similar_chunks:
            citation = CitationResult(
                source_text=chunk_data.text,
                source_metadata=chunk_data.metadata,
                confidence_score=similarity_score,
                chunk_id=chunk_data.chunk_id
            )
            citations.append(citation)
        
        # Sort by confidence score (descending)
        citations.sort(key=lambda x: x.confidence_score, reverse=True)
        
        logger.debug(f"Formatted {len(citations)} citations")
        return citations
    
    def clear_index_and_chunks(self) -> None:
        """
        Clear the FAISS index and chunk store to free up memory.
        This should be called when you want to start fresh or clean up resources.
        """
        logger.info("Clearing FAISS index and chunk store")
        
        # Clear FAISS index
        if self.faiss_index is not None:
            # Reset the FAISS index to None
            self.faiss_index.reset()  # Clear all vectors from the index
            self.faiss_index = None
            logger.debug("FAISS index cleared")
        
        # Clear chunk store
        if self.chunk_store:
            chunks_cleared = len(self.chunk_store)
            self.chunk_store.clear()
            logger.debug(f"Cleared {chunks_cleared} chunks from chunk store")
        
        logger.info("Successfully cleared FAISS index and chunk store")
    
    def get_citation_stats(self) -> Dict[str, Any]:
        """
        Get statistics about the citation service
        
        Returns:
            Dictionary with service statistics
        """
        return {
            "chunks_in_memory": len(self.chunk_store),
            "faiss_index_built": self.faiss_index is not None,
            "embedding_model": "all-MiniLM-L6-v2",
            "chunk_size": settings.get("citation_chunk_size", 500),
            "chunk_overlap": settings.get("citation_chunk_overlap", 50),
            "storage_strategy": "separate_chunk_and_embedding_collections",
            "supports_many_to_many": True
        }
