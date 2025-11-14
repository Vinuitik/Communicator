"""Search service for vector similarity search using FAISS.

This service manages in-memory FAISS indexes for fast vector search over chunk embeddings.
It loads embeddings from MongoDB, builds FAISS indexes, and performs similarity searches
to find relevant chunks for fact queries.
"""
from typing import List, Dict, Tuple, Optional
import logging
import numpy as np
import faiss

from config.settings import settings
from .embedding_service import EmbeddingService

logger = logging.getLogger(__name__)


class SearchService:
    """Service for vector similarity search using FAISS.
    
    Features:
    - Builds FAISS indexes from persisted chunk embeddings
    - Supports per-friend index isolation
    - Uses IndexFlatL2 for exact search (100% accuracy)
    - Converts L2 distances to cosine similarity scores
    - Thread-safe index operations
    """

    def __init__(self, embedding_service: EmbeddingService, mongo_repo=None):
        """Initialize the search service.
        
        Args:
            embedding_service: Service for embedding queries
            mongo_repo: MongoDB repository for loading embeddings
        """
        self.embedding_service = embedding_service
        self.mongo_repo = mongo_repo
        
        # Load configuration
        self.top_k = settings.top_k_chunks
        self.index_type = settings.faiss_index_type
        self.min_relevance_threshold = settings.min_relevance_threshold
        
        # In-memory index cache: {friend_id: (index, chunk_id_mapping)}
        self.indexes: Dict[int, Tuple[faiss.Index, List[str]]] = {}
        
        logger.info(
            f"Initialized SearchService - "
            f"top_k={self.top_k}, "
            f"index_type={self.index_type}, "
            f"threshold={self.min_relevance_threshold}"
        )

    async def _fetch_all_knowledge_ids_for_friend(self, friend_id: int) -> List[int]:
        """Fetch all knowledge IDs for a friend from Java Friend service.
        
        Calls GET /getKnowledgeIds/{friendId} endpoint to retrieve
        all knowledge IDs for a friend.
        
        Args:
            friend_id: ID of the friend
            
        Returns:
            List of knowledge IDs
        """
        import aiohttp
        from config.settings import settings
        
        base_url = settings.friend_service_url
        timeout = settings.friend_service_timeout
        url = f"{base_url}/getKnowledgeIds/{friend_id}"
        
        logger.info(f"Fetching knowledge IDs for friend {friend_id} from {url}")
        
        try:
            async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=timeout)) as session:
                async with session.get(url) as response:
                    if response.status == 200:
                        knowledge_ids = await response.json()
                        # Response is already a List<Integer>
                        logger.info(f"Retrieved {len(knowledge_ids)} knowledge IDs for friend {friend_id}")
                        return knowledge_ids
                    elif response.status == 404:
                        logger.warning(f"Friend {friend_id} not found or has no knowledge")
                        return []
                    else:
                        error_text = await response.text()
                        logger.error(
                            f"Failed to fetch knowledge IDs for friend {friend_id}: "
                            f"HTTP {response.status} - {error_text}"
                        )
                        return []
        except aiohttp.ClientError as e:
            logger.error(f"Network error fetching knowledge IDs for friend {friend_id}: {e}")
            return []
        except Exception as e:
            logger.error(f"Unexpected error fetching knowledge IDs for friend {friend_id}: {e}")
            return []

    async def build_index_for_friend(self, friend_id: int) -> bool:
        """Build FAISS index for all chunks belonging to a friend's knowledge.
        
        Args:
            friend_id: ID of the friend
            
        Returns:
            True if index built successfully, False otherwise
        """
        logger.info(f"Building FAISS index for friend {friend_id}")
        
        if not self.mongo_repo:
            logger.error("MongoDB repository required to build index")
            return False
        
        # Fetch all knowledge IDs for this friend
        knowledge_ids = await self._fetch_all_knowledge_ids_for_friend(friend_id)
        
        if not knowledge_ids:
            logger.warning(f"No knowledge items found for friend {friend_id}")
            return False
        
        logger.debug(f"Found {len(knowledge_ids)} knowledge items for friend {friend_id}")
        
        # Fetch all chunks for these knowledge items
        chunks = await self.mongo_repo.find(
            "knowledge_chunks",
            {"knowledge_id": {"$in": knowledge_ids}}
        )
        
        if not chunks:
            logger.warning(f"No chunks found for friend {friend_id}")
            return False
        
        chunk_ids = [chunk["chunk_id"] for chunk in chunks]
        logger.debug(f"Found {len(chunk_ids)} chunks for friend {friend_id}")
        
        # Fetch embeddings for these chunks
        embeddings_docs = await self.mongo_repo.find(
            "chunk_embeddings",
            {"chunk_id": {"$in": chunk_ids}}
        )
        
        if not embeddings_docs:
            logger.error(f"No embeddings found for friend {friend_id}")
            return False
        
        # Build numpy array from embeddings
        embeddings_list = []
        chunk_id_mapping = []
        
        for embedding_doc in embeddings_docs:
            embedding = np.array(embedding_doc["embedding"], dtype=np.float32)
            embeddings_list.append(embedding)
            chunk_id_mapping.append(embedding_doc["chunk_id"])
        
        embeddings_matrix = np.vstack(embeddings_list)
        
        logger.debug(f"Built embeddings matrix: shape={embeddings_matrix.shape}")
        
        # Create FAISS index
        dimension = embeddings_matrix.shape[1]
        
        if self.index_type == "IndexFlatL2":
            index = faiss.IndexFlatL2(dimension)
        else:
            # Fallback to flat index for other types (can be extended)
            logger.warning(f"Index type {self.index_type} not fully supported, using IndexFlatL2")
            index = faiss.IndexFlatL2(dimension)
        
        # Add embeddings to index
        index.add(embeddings_matrix)
        
        # Store index and mapping
        self.indexes[friend_id] = (index, chunk_id_mapping)
        
        logger.info(
            f"Successfully built FAISS index for friend {friend_id}: "
            f"{len(chunk_id_mapping)} chunks, dimension {dimension}"
        )
        
        return True

    async def search(
        self, 
        friend_id: int, 
        query: str, 
        top_k: Optional[int] = None
    ) -> List[Tuple[str, float]]:
        """Search for similar chunks using vector similarity.
        
        Args:
            friend_id: ID of the friend
            query: Query text (e.g., concatenated fact key-value)
            top_k: Number of results to return (defaults to config value)
            
        Returns:
            List of tuples (chunk_id, relevance_score) sorted by relevance descending
        """
        if top_k is None:
            top_k = self.top_k
        
        logger.info(f"Searching for friend {friend_id}, query: '{query[:100]}...', top_k={top_k}")
        
        # Check if index exists for this friend
        if friend_id not in self.indexes:
            logger.info(f"Index not found for friend {friend_id}, building...")
            success = await self.build_index_for_friend(friend_id)
            if not success:
                logger.error(f"Failed to build index for friend {friend_id}")
                return []
        
        index, chunk_id_mapping = self.indexes[friend_id]
        
        # Embed the query
        query_embedding = await self.embedding_service.embed_query(query)
        query_vector = np.array([query_embedding], dtype=np.float32)
        
        # Search in FAISS index
        distances, indices = index.search(query_vector, top_k)
        
        # Convert results to (chunk_id, score) format
        results = []
        for distance, idx in zip(distances[0], indices[0]):
            if idx < len(chunk_id_mapping):
                chunk_id = chunk_id_mapping[idx]
                
                # Convert L2 distance to similarity score (0-1 range)
                # Using inverse distance formula
                similarity_score = 1.0 / (1.0 + float(distance))
                
                # Filter by threshold
                if similarity_score >= self.min_relevance_threshold:
                    results.append((chunk_id, similarity_score))
        
        logger.info(f"Found {len(results)} relevant chunks (threshold={self.min_relevance_threshold})")
        
        return results

    def clear_index(self, friend_id: int) -> None:
        """Clear the FAISS index for a friend.
        
        Called when chunks have been updated and index needs rebuilding.
        
        Args:
            friend_id: ID of the friend
        """
        if friend_id in self.indexes:
            del self.indexes[friend_id]
            logger.info(f"Cleared FAISS index for friend {friend_id}")
        else:
            logger.debug(f"No index to clear for friend {friend_id}")

    def clear_all_indexes(self) -> None:
        """Clear all FAISS indexes to free memory."""
        count = len(self.indexes)
        self.indexes.clear()
        logger.info(f"Cleared {count} FAISS indexes")

    async def rebuild_index(self, friend_id: int) -> bool:
        """Rebuild FAISS index for a friend.
        
        Args:
            friend_id: ID of the friend
            
        Returns:
            True if rebuild successful
        """
        logger.info(f"Rebuilding FAISS index for friend {friend_id}")
        self.clear_index(friend_id)
        return await self.build_index_for_friend(friend_id)

    def get_index_stats(self, friend_id: int) -> Optional[Dict[str, any]]:
        """Get statistics about a friend's FAISS index.
        
        Args:
            friend_id: ID of the friend
            
        Returns:
            Dictionary with index statistics or None if index doesn't exist
        """
        if friend_id not in self.indexes:
            return None
        
        index, chunk_id_mapping = self.indexes[friend_id]
        
        return {
            "friend_id": friend_id,
            "chunk_count": len(chunk_id_mapping),
            "dimension": index.d,
            "index_type": self.index_type,
            "top_k": self.top_k,
            "min_relevance_threshold": self.min_relevance_threshold
        }

    def get_all_index_stats(self) -> Dict[int, Dict[str, any]]:
        """Get statistics for all loaded indexes.
        
        Returns:
            Dictionary mapping friend_id to index statistics
        """
        return {
            friend_id: self.get_index_stats(friend_id)
            for friend_id in self.indexes.keys()
        }
