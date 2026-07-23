"""Search service for hybrid vector + full-text search over chunk embeddings.

Replaces the old FAISS-in-RAM implementation. Chunks and their embeddings now
live directly in Postgres/ParadeDB (knowledge_chunks + chunk_embeddings), so
there's no in-memory index to build or manage — every search runs two ranked
queries against Postgres (pgvector cosine distance, pg_search BM25 relevance)
scoped to a friend's knowledge_ids, and fuses them with Reciprocal Rank Fusion
(RRF): score = sum(1 / (rrf_k + rank)) across whichever ranking(s) a chunk
appears in. RRF needs no score normalization between the two very different
scales (cosine distance vs. BM25 relevance), which is why it's used instead of
a weighted blend of raw scores.
"""
from typing import List, Tuple, Optional
import logging

from config.settings import settings
from .embedding_service import EmbeddingService
from .friend_api_service import FriendApiService

logger = logging.getLogger(__name__)


class SearchService:
    """Service for hybrid vector + BM25 similarity search over chunks.

    Features:
    - pgvector `<=>` cosine distance for semantic similarity
    - pg_search `@@@` BM25 for lexical relevance
    - Reciprocal Rank Fusion to combine both rankings
    - Scoped per-friend via knowledge_id membership (no per-friend index to
      build/clear/rebuild — that was a FAISS-in-RAM artifact, gone now)
    """

    def __init__(
        self,
        embedding_service: EmbeddingService,
        friend_api_service: FriendApiService,
        postgres_repo=None
    ):
        """Initialize the search service.

        Args:
            embedding_service: Service for embedding queries
            friend_api_service: Service for Friend API calls
            postgres_repo: PostgresRepository instance (uses its .pool)
        """
        self.embedding_service = embedding_service
        self.friend_api_service = friend_api_service
        self.postgres_repo = postgres_repo

        # Load configuration
        self.top_k = settings.top_k_chunks
        self.candidates_per_side = settings.search_candidates_per_side
        self.rrf_k = settings.search_rrf_k
        self.min_relevance_threshold = settings.min_relevance_threshold

        logger.info(
            f"Initialized SearchService - "
            f"top_k={self.top_k}, candidates_per_side={self.candidates_per_side}, "
            f"rrf_k={self.rrf_k}, threshold={self.min_relevance_threshold}"
        )

    async def search(
        self,
        friend_id: int,
        query: str,
        top_k: Optional[int] = None
    ) -> List[Tuple[str, float]]:
        """Search for similar chunks using hybrid vector + BM25 search.

        Args:
            friend_id: ID of the friend
            query: Query text (e.g., concatenated fact key-value)
            top_k: Number of results to return (defaults to config value)

        Returns:
            List of tuples (chunk_id, rrf_score) sorted by relevance descending
        """
        if top_k is None:
            top_k = self.top_k

        logger.info("=" * 80)
        logger.info(f"SEARCH SERVICE: Starting hybrid search")
        logger.info(f"Friend ID: {friend_id}, Query: '{query}', Top K: {top_k}")

        if not self.postgres_repo or not self.postgres_repo.pool:
            logger.error("PostgreSQL repository not initialized")
            return []

        knowledge_ids = await self.friend_api_service.fetch_knowledge_ids_for_friend(friend_id)
        if not knowledge_ids:
            logger.warning(f"No knowledge items found for friend {friend_id}")
            return []

        query_embedding = await self.embedding_service.embed_query(query)

        async with self.postgres_repo.pool.acquire() as conn:
            vector_rows = await conn.fetch(
                """
                SELECT kc.chunk_id
                FROM chunk_embeddings ce
                JOIN knowledge_chunks kc ON kc.chunk_id = ce.chunk_id
                WHERE kc.knowledge_id = ANY($1)
                ORDER BY ce.embedding <=> $2
                LIMIT $3
                """,
                knowledge_ids, query_embedding, self.candidates_per_side
            )
            # paradedb.match() rather than raw `chunk_text @@@ $2`: the raw string
            # form runs through ParadeDB's query mini-language, which errors out
            # on ordinary punctuation in natural-language queries (apostrophes,
            # question marks). match() treats the whole param as literal text.
            bm25_rows = await conn.fetch(
                """
                SELECT chunk_id
                FROM knowledge_chunks
                WHERE knowledge_id = ANY($1)
                  AND chunk_id @@@ paradedb.match('chunk_text', $2)
                ORDER BY paradedb.score(chunk_id) DESC
                LIMIT $3
                """,
                knowledge_ids, query, self.candidates_per_side
            )

        vector_ranks = {row["chunk_id"]: rank for rank, row in enumerate(vector_rows, start=1)}
        bm25_ranks = {row["chunk_id"]: rank for rank, row in enumerate(bm25_rows, start=1)}
        logger.info(f"Vector candidates: {len(vector_ranks)}, BM25 candidates: {len(bm25_ranks)}")

        fused_scores = {}
        for chunk_id, rank in vector_ranks.items():
            fused_scores[chunk_id] = fused_scores.get(chunk_id, 0.0) + 1.0 / (self.rrf_k + rank)
        for chunk_id, rank in bm25_ranks.items():
            fused_scores[chunk_id] = fused_scores.get(chunk_id, 0.0) + 1.0 / (self.rrf_k + rank)

        results = [
            (chunk_id, score) for chunk_id, score in fused_scores.items()
            if score >= self.min_relevance_threshold
        ]
        results.sort(key=lambda x: x[1], reverse=True)
        results = results[:top_k]

        logger.info(f"Found {len(results)} fused results passing threshold")
        for idx, (chunk_id, score) in enumerate(results[:5], 1):
            logger.info(f"  {idx}. {chunk_id}: {score:.4f}")
        logger.info("=" * 80)

        return results
