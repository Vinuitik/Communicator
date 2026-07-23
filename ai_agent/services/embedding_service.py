"""Embedding service using the standalone embedder microservice (ONNX EmbeddingGemma).

Replaces the old Ollama-backed version. Supports batching, caching, and retry logic
same as before; the only functional change beyond the backend swap is that this
model is prompt-asymmetric, so embed_texts (documents) and embed_query (queries) now
send different `kind` values to the embedder rather than being identical calls.
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
    """Provides text embedding using the local embedder service.

    Contract:
    - Inputs: Text strings or list of strings to embed
    - Outputs: Embedding vectors as lists of floats
    - Error modes: Raises on API failures, network issues, or invalid inputs
    - Success: Returns embeddings with same order as input texts

    Features:
    - Uses the locally hosted embedder (ONNX EmbeddingGemma, 768d) for complete
      control and no rate limits, same rationale as the Ollama version it replaced
    - Supports batch processing for efficiency
    - Optional Redis caching to avoid redundant API calls
    - Automatic retry logic with exponential backoff
    - Prompt-asymmetric: document vs query texts get different embeddings from the
      same model (see embedder/model_runtime.py) — embed_texts always means
      "document", embed_query always means "query". Do not conflate them.
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

        # Get embedder service configuration
        self.embedder_url = embedding_config.get("embedder_url", "http://embedder:8010")
        self.api_url = f"{self.embedder_url}/embed"

        logger.info(f"Initialized EmbeddingService with embedder model: {self.model}")
        logger.info(f"Embedder API URL: {self.api_url}")

    def _get_cache_key(self, text: str, kind: str) -> str:
        """Generate a cache key for a text string.

        Includes `kind` since document/query embeddings of the same text differ
        (prompt-asymmetric model) — they must not collide in cache.
        """
        content = f"{self.model}:{kind}:{text}"
        return f"embedding:{hashlib.md5(content.encode()).hexdigest()}"

    async def _get_cached_embedding(self, text: str, kind: str) -> Optional[List[float]]:
        """Retrieve cached embedding from Redis if available."""
        if not self.cache_enabled or not self.redis_repo:
            return None

        cache_key = self._get_cache_key(text, kind)
        cached = await self.redis_repo.get(cache_key)

        if cached:
            try:
                return json.loads(cached)
            except json.JSONDecodeError:
                logger.warning(f"Failed to decode cached embedding for key: {cache_key}")
                return None
        return None

    async def _cache_embedding(self, text: str, kind: str, embedding: List[float]):
        """Store embedding in Redis cache."""
        if not self.cache_enabled or not self.redis_repo:
            return

        cache_key = self._get_cache_key(text, kind)
        try:
            await self.redis_repo.set(
                cache_key,
                json.dumps(embedding),
                ex=self.cache_ttl
            )
        except Exception as e:
            logger.warning(f"Failed to cache embedding: {e}")

    async def _call_embedder_api(
        self,
        texts: List[str],
        kind: str,
        session: ClientSession
    ) -> List[List[float]]:
        """Call the embedder service to get embeddings for a batch.

        Args:
            texts: List of texts to embed
            kind: "document" or "query" — the embedder applies the model's
                prompt prefix accordingly
            session: aiohttp ClientSession for making requests

        Returns:
            List of embedding vectors, same order as `texts`

        Raises:
            Exception if API call fails after retries
        """
        payload = {"texts": texts, "kind": kind}

        for attempt in range(self.max_retries):
            try:
                timeout = ClientTimeout(total=self.timeout)
                async with session.post(
                    self.api_url,
                    json=payload,
                    timeout=timeout
                ) as response:
                    if response.status == 200:
                        result = await response.json()
                        embeddings = result.get("embeddings")
                        if embeddings and len(embeddings) == len(texts):
                            return embeddings
                        raise Exception(
                            f"Embedder returned {len(embeddings) if embeddings else 0}"
                            f"/{len(texts)} embeddings"
                        )
                    else:
                        error_text = await response.text()
                        logger.error(f"Embedder API error {response.status}: {error_text}")
                        raise Exception(f"API returned status {response.status}: {error_text}")

            except ClientError as e:
                logger.warning(f"Attempt {attempt + 1}/{self.max_retries} failed: {e}")
                if attempt < self.max_retries - 1:
                    wait_time = 2 ** attempt
                    await asyncio.sleep(wait_time)
                else:
                    raise

        raise Exception("Failed to get embeddings after retries")

    async def _embed(self, texts: List[str], kind: str) -> List[List[float]]:
        """Embed multiple texts in batches, with caching, for a given kind.

        Args:
            texts: List of texts to embed
            kind: "document" or "query"

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
            cached = await self._get_cached_embedding(text, kind)
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
                    batch_embeddings = await self._call_embedder_api(batch_texts, kind, session)

                    # Cache and store results
                    for text, embedding, idx in zip(batch_texts, batch_embeddings, batch_indices):
                        await self._cache_embedding(text, kind, embedding)
                        embeddings.append((idx, embedding))

        # Sort by original index and return embeddings only
        embeddings.sort(key=lambda x: x[0])
        return [emb for _, emb in embeddings]

    async def embed_text(self, text: str) -> List[float]:
        """Embed a single document text string.

        Args:
            text: Text to embed

        Returns:
            Embedding vector as list of floats
        """
        if not text or not text.strip():
            raise ValueError("Text cannot be empty")

        embeddings = await self.embed_texts([text])
        return embeddings[0]

    async def embed_texts(self, texts: List[str]) -> List[List[float]]:
        """Embed multiple document texts in batches.

        Args:
            texts: List of document texts to embed

        Returns:
            List of embedding vectors in same order as input texts
        """
        return await self._embed(texts, kind="document")

    async def embed_query(self, query: str) -> List[float]:
        """Embed a search query.

        Prompt-asymmetric model: this is NOT the same embedding as embed_text
        would produce for identical text — the embedder applies a different
        prompt prefix for queries vs documents.

        Args:
            query: Query text to embed

        Returns:
            Query embedding vector
        """
        if not query or not query.strip():
            raise ValueError("Query cannot be empty")

        embeddings = await self._embed([query], kind="query")
        return embeddings[0]

    async def embed_documents(self, documents: List[str]) -> List[List[float]]:
        """Embed multiple documents for indexing.

        Args:
            documents: List of documents to embed

        Returns:
            List of document embedding vectors
        """
        return await self.embed_texts(documents)

    def get_embedding_dimension(self) -> int:
        """Get the dimension of embedding vectors for the current model."""
        return 768  # onnx-community/embeddinggemma-300m-ONNX
