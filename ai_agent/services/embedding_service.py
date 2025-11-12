"""Embedding service using HuggingFace Inference API.

This service provides text embedding capabilities using HuggingFace's hosted models,
eliminating the need for local GPU resources. Supports batching, caching, and retry logic.
"""
from typing import List, Union, Optional
import asyncio
import hashlib
import json
import logging
from aiohttp import ClientSession, ClientTimeout, ClientError
from config.settings import settings

logger = logging.getLogger(__name__)


class EmbeddingService:
    """Provides text embedding using HuggingFace Inference API.
    
    Contract:
    - Inputs: Text strings or list of strings to embed
    - Outputs: Embedding vectors as lists of floats
    - Error modes: Raises on API failures, network issues, or invalid inputs
    - Success: Returns embeddings with same order as input texts
    
    Features:
    - Uses same encoder for both queries and documents (symmetric embedding)
    - Supports batch processing for efficiency
    - Optional Redis caching to avoid redundant API calls
    - Automatic retry logic with exponential backoff
    """

    def __init__(self, redis_repo=None):
        """Initialize the embedding service.
        
        Args:
            redis_repo: Optional Redis repository for caching embeddings
        """
        self.redis_repo = redis_repo
        
        # Load configuration
        embedding_config = settings.get_embedding_config()
        self.model = embedding_config["model"]
        self.timeout = embedding_config["timeout"]
        self.max_retries = embedding_config["max_retries"]
        self.batch_size = embedding_config["batch_size"]
        self.cache_enabled = embedding_config["cache_embeddings"]
        self.cache_ttl = embedding_config["embedding_cache_ttl"]
        
        # Get API key from settings (already loaded from environment)
        self.api_key = settings.huggingface_api_key
        if not self.api_key:
            logger.warning("HUGGINGFACE_API_KEY not found in environment variables")
            raise ValueError("HUGGINGFACE_API_KEY must be set in .env file")
        
        # HuggingFace Inference API endpoint
        self.api_url = f"https://api-inference.huggingface.co/pipeline/feature-extraction/{self.model}"
        
        logger.info(f"Initialized EmbeddingService with model: {self.model}")

    def _get_cache_key(self, text: str) -> str:
        """Generate a cache key for a text string.
        
        Uses MD5 hash of model name + text to create a unique key.
        """
        content = f"{self.model}:{text}"
        return f"embedding:{hashlib.md5(content.encode()).hexdigest()}"

    async def _get_cached_embedding(self, text: str) -> Optional[List[float]]:
        """Retrieve cached embedding from Redis if available."""
        if not self.cache_enabled or not self.redis_repo:
            return None
        
        cache_key = self._get_cache_key(text)
        cached = await self.redis_repo.get(cache_key)
        
        if cached:
            try:
                return json.loads(cached)
            except json.JSONDecodeError:
                logger.warning(f"Failed to decode cached embedding for key: {cache_key}")
                return None
        return None

    async def _cache_embedding(self, text: str, embedding: List[float]):
        """Store embedding in Redis cache."""
        if not self.cache_enabled or not self.redis_repo:
            return
        
        cache_key = self._get_cache_key(text)
        try:
            await self.redis_repo.set(
                cache_key,
                json.dumps(embedding),
                ex=self.cache_ttl
            )
        except Exception as e:
            logger.warning(f"Failed to cache embedding: {e}")

    async def _call_huggingface_api(
        self, 
        texts: List[str], 
        session: ClientSession
    ) -> List[List[float]]:
        """Call HuggingFace Inference API to get embeddings.
        
        Args:
            texts: List of texts to embed
            session: aiohttp ClientSession for making requests
            
        Returns:
            List of embedding vectors
            
        Raises:
            Exception if API call fails after retries
        """
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "inputs": texts,
            "options": {
                "wait_for_model": True  # Wait if model is loading
            }
        }
        
        for attempt in range(self.max_retries):
            try:
                timeout = ClientTimeout(total=self.timeout)
                async with session.post(
                    self.api_url,
                    headers=headers,
                    json=payload,
                    timeout=timeout
                ) as response:
                    if response.status == 200:
                        result = await response.json()
                        logger.debug(f"Successfully got embeddings for {len(texts)} texts")
                        return result
                    elif response.status == 503:
                        # Model is loading, wait and retry
                        error_data = await response.json()
                        wait_time = error_data.get("estimated_time", 20)
                        logger.info(f"Model loading, waiting {wait_time}s...")
                        await asyncio.sleep(wait_time)
                        continue
                    else:
                        error_text = await response.text()
                        logger.error(f"HuggingFace API error {response.status}: {error_text}")
                        raise Exception(f"API returned status {response.status}: {error_text}")
                        
            except ClientError as e:
                logger.warning(f"Attempt {attempt + 1}/{self.max_retries} failed: {e}")
                if attempt < self.max_retries - 1:
                    # Exponential backoff
                    wait_time = 2 ** attempt
                    await asyncio.sleep(wait_time)
                else:
                    raise
        
        raise Exception(f"Failed to get embeddings after {self.max_retries} attempts")

    async def embed_text(self, text: str) -> List[float]:
        """Embed a single text string.
        
        Args:
            text: Text to embed
            
        Returns:
            Embedding vector as list of floats
        """
        if not text or not text.strip():
            raise ValueError("Text cannot be empty")
        
        # Check cache first
        cached = await self._get_cached_embedding(text)
        if cached is not None:
            logger.debug(f"Cache hit for text: {text[:50]}...")
            return cached
        
        # Get embedding from API
        embeddings = await self.embed_texts([text])
        embedding = embeddings[0]
        
        # Cache the result
        await self._cache_embedding(text, embedding)
        
        return embedding

    async def embed_texts(self, texts: List[str]) -> List[List[float]]:
        """Embed multiple texts in batches.
        
        Args:
            texts: List of texts to embed
            
        Returns:
            List of embedding vectors in same order as input texts
        """
        if not texts:
            return []
        
        # Filter out empty texts
        valid_texts = [t for t in texts if t and t.strip()]
        if len(valid_texts) != len(texts):
            logger.warning(f"Filtered out {len(texts) - len(valid_texts)} empty texts")
        
        if not valid_texts:
            raise ValueError("All texts are empty")
        
        # Check cache for all texts
        embeddings = []
        texts_to_fetch = []
        text_indices = []
        
        for idx, text in enumerate(valid_texts):
            cached = await self._get_cached_embedding(text)
            if cached is not None:
                embeddings.append((idx, cached))
            else:
                texts_to_fetch.append(text)
                text_indices.append(idx)
        
        logger.info(f"Cache hits: {len(embeddings)}/{len(valid_texts)}, fetching: {len(texts_to_fetch)}")
        
        # Fetch uncached embeddings in batches
        if texts_to_fetch:
            async with ClientSession() as session:
                for i in range(0, len(texts_to_fetch), self.batch_size):
                    batch_texts = texts_to_fetch[i:i + self.batch_size]
                    batch_indices = text_indices[i:i + self.batch_size]
                    
                    logger.debug(f"Processing batch {i // self.batch_size + 1}: {len(batch_texts)} texts")
                    batch_embeddings = await self._call_huggingface_api(batch_texts, session)
                    
                    # Cache and store results
                    for text, embedding, idx in zip(batch_texts, batch_embeddings, batch_indices):
                        await self._cache_embedding(text, embedding)
                        embeddings.append((idx, embedding))
        
        # Sort by original index and return embeddings only
        embeddings.sort(key=lambda x: x[0])
        return [emb for _, emb in embeddings]

    async def embed_query(self, query: str) -> List[float]:
        """Embed a search query.
        
        For symmetric embeddings, this is identical to embed_text.
        Provided for semantic clarity in search/retrieval contexts.
        
        Args:
            query: Query text to embed
            
        Returns:
            Query embedding vector
        """
        return await self.embed_text(query)

    async def embed_documents(self, documents: List[str]) -> List[List[float]]:
        """Embed multiple documents for indexing.
        
        For symmetric embeddings, this is identical to embed_texts.
        Provided for semantic clarity in indexing contexts.
        
        Args:
            documents: List of documents to embed
            
        Returns:
            List of document embedding vectors
        """
        return await self.embed_texts(documents)

    def get_embedding_dimension(self) -> int:
        """Get the dimension of embedding vectors for the current model.
        
        Returns:
            Embedding dimension size
        """
        model_dimensions = {
            "sentence-transformers/all-MiniLM-L6-v2": 384,
            "sentence-transformers/all-mpnet-base-v2": 768,
            "BAAI/bge-small-en-v1.5": 384,
            "intfloat/e5-base-v2": 768,
        }
        return model_dimensions.get(self.model, 384)  # Default to 384
