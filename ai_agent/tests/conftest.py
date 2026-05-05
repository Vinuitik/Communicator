"""
Shared pytest fixtures for all ai_agent test tiers.

GEMINI_API_KEY is set before any Settings() import so the module-level
`settings = Settings()` succeeds without a real key.
"""
import os
os.environ.setdefault("GEMINI_API_KEY", "test-api-key")

import numpy as np
import pytest
from unittest.mock import AsyncMock, MagicMock


# ---------------------------------------------------------------------------
# Embedding helpers
# ---------------------------------------------------------------------------

def _unit_vec(dim: int = 384) -> list:
    vec = np.random.default_rng(42).random(dim).astype(np.float32)
    return (vec / np.linalg.norm(vec)).tolist()


@pytest.fixture
def sample_embedding():
    return _unit_vec(384)


@pytest.fixture
def sample_embeddings():
    rng = np.random.default_rng(0)
    result = []
    for _ in range(5):
        v = rng.random(384).astype(np.float32)
        result.append((v / np.linalg.norm(v)).tolist())
    return result


# ---------------------------------------------------------------------------
# Sample domain data
# ---------------------------------------------------------------------------

@pytest.fixture
def sample_knowledge_texts():
    return [
        "Alice loves hiking and photography. She goes on mountain trails every weekend.",
        "Alice works as a software engineer at a startup in San Francisco.",
        "Alice has two cats named Max and Bella. She adopted them from a local shelter.",
    ]


@pytest.fixture
def sample_knowledge_items():
    return [
        {"id": 1, "fact": "Alice loves hiking", "importance": 5},
        {"id": 2, "fact": "Alice is a software engineer", "importance": 4},
    ]


# ---------------------------------------------------------------------------
# Repository mocks
# ---------------------------------------------------------------------------

@pytest.fixture
def mock_redis_repo():
    repo = AsyncMock()
    repo.get = AsyncMock(return_value=None)
    repo.set = AsyncMock(return_value=True)
    repo.delete = AsyncMock(return_value=1)
    repo.keys = AsyncMock(return_value=[])
    return repo


@pytest.fixture
def mock_mongo_repo():
    repo = AsyncMock()
    repo.find_many = AsyncMock(return_value=[])
    repo.find_one = AsyncMock(return_value=None)
    repo.insert_many = AsyncMock(return_value=None)
    repo.delete_many = AsyncMock(return_value=0)
    return repo


@pytest.fixture
def mock_chunk_repo():
    repo = AsyncMock()
    repo.find_chunks_by_knowledge_and_hash = AsyncMock(return_value=[])
    repo.delete_chunks_and_embeddings = AsyncMock(return_value=None)
    repo.create_chunk_documents = MagicMock(return_value=([], [], []))
    repo.save_chunks = AsyncMock(return_value=None)
    repo.find_chunk_by_id = AsyncMock(return_value=None)
    repo.find_chunks_by_ids = AsyncMock(return_value=[])
    repo.find_chunks_missing_embeddings = AsyncMock(return_value=[])
    repo.count_chunks_by_knowledge_id = AsyncMock(return_value=0)
    return repo


@pytest.fixture
def mock_embedding_repo():
    repo = MagicMock()
    repo.create_embedding_documents = MagicMock(return_value=[])
    repo.save_embeddings = AsyncMock(return_value=None)
    return repo


@pytest.fixture
def mock_fact_repo():
    repo = AsyncMock()
    repo.get_friend_summary = AsyncMock(return_value=None)
    repo.save_fact = AsyncMock(return_value=None)
    repo.delete_fact = AsyncMock(return_value=None)
    repo.create_empty_summary = AsyncMock(return_value=None)
    repo.get_facts_for_friend = AsyncMock(return_value=[])
    return repo


# ---------------------------------------------------------------------------
# Service mocks
# ---------------------------------------------------------------------------

@pytest.fixture
def mock_embedding_service(sample_embedding):
    svc = AsyncMock()
    svc.embed_text = AsyncMock(return_value=sample_embedding)
    svc.embed_texts = AsyncMock(return_value=[sample_embedding])
    svc.embed_query = AsyncMock(return_value=sample_embedding)
    svc.embed_documents = AsyncMock(return_value=[sample_embedding])
    svc.get_embedding_dimension = MagicMock(return_value=384)
    return svc


@pytest.fixture
def mock_agent_service():
    svc = AsyncMock()
    svc._initialized = True
    svc.is_initialized = True
    svc.llm = AsyncMock()
    svc.generate_response = AsyncMock(
        return_value='{"is_valid": true, "confidence": 0.9, "reasoning": "Clearly supported."}'
    )
    svc.process_message = AsyncMock(
        return_value={"messages": [MagicMock(content="I can help with that.")]}
    )
    svc.list_available_tools = MagicMock(return_value=["tool_a", "tool_b"])
    svc.get_tool_by_name = MagicMock(return_value=None)
    return svc


@pytest.fixture
def mock_friend_api_service(sample_knowledge_texts, sample_knowledge_items):
    svc = AsyncMock()
    svc.fetch_knowledge_paginated = AsyncMock(return_value=sample_knowledge_items)
    svc.fetch_knowledge_text = AsyncMock(return_value=sample_knowledge_texts[0])
    svc.fetch_knowledge_texts_batch = AsyncMock(
        return_value={1: sample_knowledge_texts[0], 2: sample_knowledge_texts[1]}
    )
    svc.fetch_knowledge_ids_for_friend = AsyncMock(return_value=[1, 2])
    return svc


@pytest.fixture
def mock_search_service():
    svc = AsyncMock()
    svc.search = AsyncMock(return_value=[("chunk_1_0_abc12345", 0.92), ("chunk_2_0_def67890", 0.85)])
    svc.build_index_for_friend = AsyncMock(return_value=True)
    svc.clear_index = MagicMock()
    svc.rebuild_index = AsyncMock(return_value=True)
    return svc


@pytest.fixture
def mock_validation_service():
    svc = AsyncMock()
    svc.validate_fact = AsyncMock(return_value=(True, 0.9, "Clearly supported by source."))
    svc.meets_threshold = MagicMock(return_value=True)
    svc.get_min_confidence = MagicMock(return_value=0.8)
    return svc


@pytest.fixture
def mock_cache_service():
    svc = AsyncMock()
    svc.is_summary_cached = AsyncMock(return_value=False)
    svc.cache_summary = AsyncMock(return_value=None)
    svc.invalidate_summary = AsyncMock(return_value=None)
    return svc


@pytest.fixture
def mock_prompt_service():
    svc = AsyncMock()
    svc.generate_summary = AsyncMock(return_value={"Hobbies": "Hiking, Photography"})
    svc.parse_summary_to_facts = MagicMock(
        return_value=[("Hobbies", "Hiking, Photography"), ("Job", "Software Engineer")]
    )
    return svc


@pytest.fixture
def mock_fact_service():
    svc = AsyncMock()
    svc.create_fact_with_references = AsyncMock(return_value="fact-id-001")
    svc.get_fact_references = AsyncMock(return_value=[])
    svc.delete_fact = AsyncMock(return_value=True)
    return svc


@pytest.fixture
def mock_chunking_service():
    svc = AsyncMock()
    svc.process_knowledge = AsyncMock(return_value=["chunk_1_0_aabbccdd"])
    svc.ensure_embeddings_exist = AsyncMock(return_value=1)
    svc.get_chunk_text = AsyncMock(return_value="sample chunk text")
    svc.delete_knowledge_chunks = AsyncMock(return_value=None)
    return svc
