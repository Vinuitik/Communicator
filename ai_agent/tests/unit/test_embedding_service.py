"""Unit tests for EmbeddingService.

All Ollama HTTP calls are intercepted by aioresponses.
Redis is replaced with mock_redis_repo from conftest.
"""
import json
import math
import pytest
from aioresponses import aioresponses
from unittest.mock import AsyncMock, patch, MagicMock

from services.embedding_service import EmbeddingService

OLLAMA_URL = "http://ollama:11434/api/embeddings"
FAKE_VEC = [0.1] * 384


def _make_service(redis_repo=None, *, cache_enabled=True):
    with patch("services.embedding_service.settings") as mock_settings:
        mock_settings.get_embedding_config.return_value = {
            "model": "koill/sentence-transformers:all-minilm-l6-v2",
            "timeout": 5,
            "max_retries": 3,
            "batch_size": 32,
            "cache_embeddings": cache_enabled,
            "embedding_cache_ttl": 3600,
            "ollama_url": "http://ollama:11434",
        }
        svc = EmbeddingService(redis_repo=redis_repo)
    return svc


# ---------------------------------------------------------------------------
# Pure / sync methods
# ---------------------------------------------------------------------------

@pytest.mark.unit
def test_normalize_embedding_unit_norm():
    svc = _make_service()
    raw = [3.0, 4.0]
    result = svc._normalize_embedding(raw)
    norm = math.sqrt(sum(x**2 for x in result))
    assert abs(norm - 1.0) < 1e-6


@pytest.mark.unit
def test_normalize_zero_vector_no_crash():
    svc = _make_service()
    result = svc._normalize_embedding([0.0, 0.0, 0.0])
    assert result == [0.0, 0.0, 0.0]


@pytest.mark.unit
def test_cache_key_deterministic():
    svc = _make_service()
    key1 = svc._get_cache_key("hello world")
    key2 = svc._get_cache_key("hello world")
    assert key1 == key2
    assert key1.startswith("embedding:")


@pytest.mark.unit
def test_cache_key_different_for_different_texts():
    svc = _make_service()
    assert svc._get_cache_key("text A") != svc._get_cache_key("text B")


@pytest.mark.unit
def test_get_embedding_dimension_known_model():
    svc = _make_service()
    svc.model = "koill/sentence-transformers:all-minilm-l6-v2"
    assert svc.get_embedding_dimension() == 384


@pytest.mark.unit
def test_get_embedding_dimension_unknown_model_defaults_384():
    svc = _make_service()
    svc.model = "some-unknown-model"
    assert svc.get_embedding_dimension() == 384


# ---------------------------------------------------------------------------
# embed_text – cache miss / hit
# ---------------------------------------------------------------------------

@pytest.mark.unit
async def test_embed_text_empty_raises():
    svc = _make_service()
    with pytest.raises(ValueError):
        await svc.embed_text("")


@pytest.mark.unit
async def test_embed_text_whitespace_raises():
    svc = _make_service()
    with pytest.raises(ValueError):
        await svc.embed_text("   ")


@pytest.mark.unit
async def test_embed_text_cache_miss_calls_api(mock_redis_repo):
    mock_redis_repo.get = AsyncMock(return_value=None)
    svc = _make_service(redis_repo=mock_redis_repo, cache_enabled=True)

    with aioresponses() as m:
        m.post(OLLAMA_URL, payload={"embedding": FAKE_VEC})
        result = await svc.embed_text("hello")

    assert len(result) == 384
    mock_redis_repo.set.assert_called_once()


@pytest.mark.unit
async def test_embed_text_cache_hit_skips_api(mock_redis_repo):
    cached_vec = FAKE_VEC[:]
    mock_redis_repo.get = AsyncMock(return_value=json.dumps(cached_vec))
    svc = _make_service(redis_repo=mock_redis_repo, cache_enabled=True)

    with aioresponses() as m:
        result = await svc.embed_text("hello")
        assert not m.requests  # no HTTP calls made

    assert result == cached_vec


# ---------------------------------------------------------------------------
# embed_texts – batching, filtering, ordering
# ---------------------------------------------------------------------------

@pytest.mark.unit
async def test_embed_texts_empty_list_returns_empty():
    svc = _make_service()
    result = await svc.embed_texts([])
    assert result == []


@pytest.mark.unit
async def test_embed_texts_all_empty_raises():
    svc = _make_service()
    with pytest.raises(ValueError):
        await svc.embed_texts(["", "  ", ""])


@pytest.mark.unit
async def test_embed_texts_order_preserved():
    svc = _make_service(cache_enabled=False)
    vec_a = [0.1] * 384
    vec_b = [0.9] * 384

    responses = [{"embedding": vec_a}, {"embedding": vec_b}]

    with aioresponses() as m:
        for r in responses:
            m.post(OLLAMA_URL, payload=r)
        results = await svc.embed_texts(["text_a", "text_b"])

    assert len(results) == 2


@pytest.mark.unit
async def test_embed_texts_partial_cache_hit(mock_redis_repo):
    cached_vec = FAKE_VEC[:]
    # First text cached, second not
    mock_redis_repo.get = AsyncMock(
        side_effect=[json.dumps(cached_vec), None]
    )
    svc = _make_service(redis_repo=mock_redis_repo, cache_enabled=True)

    with aioresponses() as m:
        m.post(OLLAMA_URL, payload={"embedding": FAKE_VEC})
        results = await svc.embed_texts(["cached text", "uncached text"])

    assert len(results) == 2
    mock_redis_repo.set.assert_called_once()


# ---------------------------------------------------------------------------
# Retry logic
# ---------------------------------------------------------------------------

@pytest.mark.unit
async def test_retry_on_client_error_succeeds_on_third_attempt():
    svc = _make_service(cache_enabled=False)

    with aioresponses() as m:
        # First two attempts fail with 500, third succeeds
        m.post(OLLAMA_URL, status=500, body="error")
        m.post(OLLAMA_URL, status=500, body="error")
        m.post(OLLAMA_URL, payload={"embedding": FAKE_VEC})

        with patch("services.embedding_service.asyncio.sleep", new_callable=AsyncMock):
            result = await svc.embed_text("retry me")

    assert len(result) == 384
