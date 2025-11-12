"""Example usage of the EmbeddingService.

This demonstrates how to use the embedding service in your AI agent.
"""
import asyncio
from services.embedding_service import EmbeddingService
from repositories.redis_repository import RedisRepository


async def main():
    """Example usage of embedding service."""
    
    # Initialize Redis repository for caching (optional but recommended)
    redis_repo = RedisRepository()
    await redis_repo.initialize()
    
    # Initialize embedding service
    embedding_service = EmbeddingService(redis_repo=redis_repo)
    
    print(f"Using model: {embedding_service.model}")
    print(f"Embedding dimension: {embedding_service.get_embedding_dimension()}")
    print()
    
    # Example 1: Embed a single text
    print("=" * 60)
    print("Example 1: Embed a single text")
    print("=" * 60)
    text = "The quick brown fox jumps over the lazy dog"
    embedding = await embedding_service.embed_text(text)
    print(f"Text: {text}")
    print(f"Embedding length: {len(embedding)}")
    print(f"First 10 values: {embedding[:10]}")
    print()
    
    # Example 2: Embed multiple texts (batching)
    print("=" * 60)
    print("Example 2: Embed multiple texts")
    print("=" * 60)
    texts = [
        "Machine learning is a subset of artificial intelligence",
        "Deep learning uses neural networks with multiple layers",
        "Natural language processing helps computers understand text",
        "Computer vision enables machines to interpret images"
    ]
    embeddings = await embedding_service.embed_texts(texts)
    print(f"Embedded {len(texts)} texts")
    for i, (text, emb) in enumerate(zip(texts, embeddings), 1):
        print(f"{i}. {text[:50]}... -> {len(emb)} dimensions")
    print()
    
    # Example 3: Semantic similarity (cosine similarity)
    print("=" * 60)
    print("Example 3: Semantic Similarity")
    print("=" * 60)
    
    query = "What is AI and machine learning?"
    documents = [
        "Artificial intelligence is the simulation of human intelligence",
        "Pizza is a popular Italian food with cheese and toppings",
        "Machine learning allows computers to learn from data"
    ]
    
    # Embed query and documents
    query_embedding = await embedding_service.embed_query(query)
    doc_embeddings = await embedding_service.embed_documents(documents)
    
    # Calculate cosine similarity
    import numpy as np
    
    def cosine_similarity(vec1, vec2):
        """Calculate cosine similarity between two vectors."""
        return np.dot(vec1, vec2) / (np.linalg.norm(vec1) * np.linalg.norm(vec2))
    
    print(f"Query: {query}\n")
    similarities = []
    for doc, doc_emb in zip(documents, doc_embeddings):
        similarity = cosine_similarity(query_embedding, doc_emb)
        similarities.append((doc, similarity))
    
    # Sort by similarity (descending)
    similarities.sort(key=lambda x: x[1], reverse=True)
    
    print("Results (ranked by similarity):")
    for i, (doc, score) in enumerate(similarities, 1):
        print(f"{i}. [{score:.4f}] {doc}")
    print()
    
    # Example 4: Caching demonstration
    print("=" * 60)
    print("Example 4: Caching Demonstration")
    print("=" * 60)
    test_text = "This text will be cached"
    
    import time
    
    # First call (not cached)
    start = time.time()
    await embedding_service.embed_text(test_text)
    first_time = time.time() - start
    
    # Second call (cached)
    start = time.time()
    await embedding_service.embed_text(test_text)
    second_time = time.time() - start
    
    print(f"First call (API): {first_time:.3f}s")
    print(f"Second call (cache): {second_time:.3f}s")
    print(f"Speedup: {first_time / second_time:.1f}x faster")
    print()
    
    # Cleanup
    await redis_repo.close()
    print("Done!")


if __name__ == "__main__":
    asyncio.run(main())
