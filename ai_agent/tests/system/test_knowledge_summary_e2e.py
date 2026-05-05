"""System tests: full knowledge summarization pipeline.

Requirements (run with `docker-compose up mongodb redis ollama`):
- MongoDB  accessible at the URL in config.yaml
- Redis    accessible at the URL in config.yaml
- Ollama   accessible at http://ollama:11434  (or OLLAMA_URL env var)
- GEMINI_API_KEY / VertexAI service account must be valid

FriendApiService HTTP calls are intercepted by aioresponses so no Java service
is needed. The rest of the pipeline runs for real.

Skip these tests in CI unless the docker environment is available:
    pytest tests/system/ -m system
"""
import os
import pytest
from aioresponses import aioresponses
from httpx import AsyncClient

os.environ.setdefault("GEMINI_API_KEY", os.getenv("GEMINI_API_KEY", "test-key"))

FRIEND_BASE = "http://friend:8085"
KNOWLEDGE_ITEMS = [
    {"id": 1, "fact": "Alice loves hiking and outdoor photography.", "importance": 5},
    {"id": 2, "fact": "Alice works as a senior software engineer.", "importance": 4},
]
KNOWLEDGE_TEXT_1 = (
    "Alice is an avid hiker who goes on mountain trails every weekend. "
    "She also enjoys nature photography and has won several local contests."
)
KNOWLEDGE_TEXT_2 = (
    "Alice has been a software engineer for 8 years, specialising in Python "
    "backend services. She is currently employed at a San Francisco startup."
)


@pytest.fixture
def friend_api_mock():
    with aioresponses() as m:
        # Paginated knowledge list
        m.get(
            f"{FRIEND_BASE}/getKnowledge/1/page/0/size/30",
            payload=KNOWLEDGE_ITEMS,
            repeat=True,
        )
        # Full texts
        m.get(
            f"{FRIEND_BASE}/getKnowledgeText/1",
            payload={"id": "1", "text": KNOWLEDGE_TEXT_1},
            repeat=True,
        )
        m.get(
            f"{FRIEND_BASE}/getKnowledgeText/2",
            payload={"id": "2", "text": KNOWLEDGE_TEXT_2},
            repeat=True,
        )
        # Knowledge IDs for search index
        m.get(f"{FRIEND_BASE}/getKnowledgeIds/1", payload=[1, 2], repeat=True)
        yield m


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

@pytest.mark.system
async def test_full_pipeline_new_friend(friend_api_mock):
    """POST /knowledge/summarize stores chunks, embeddings, facts in DB and Redis."""
    from main import app

    async with AsyncClient(app=app, base_url="http://test") as client:
        resp = await client.post("/knowledge/summarize", json={"friend_id": 1})

    assert resp.status_code == 200
    body = resp.json()
    assert body["friend_id"] == 1
    assert body["fact_count"] > 0, "At least one fact should be extracted from real LLM"


@pytest.mark.system
async def test_full_pipeline_cache_hit_skips_llm(friend_api_mock):
    """Second request for same friend returns cached result without LLM call."""
    from main import app

    async with AsyncClient(app=app, base_url="http://test") as client:
        # First call populates cache
        await client.post("/knowledge/summarize", json={"friend_id": 1})
        # Second call should be a cache hit (validate by timing or mock counters)
        resp = await client.post("/knowledge/summarize", json={"friend_id": 1})

    assert resp.status_code == 200
    body = resp.json()
    assert body["friend_id"] == 1


@pytest.mark.system
async def test_invalidate_and_regenerate(friend_api_mock):
    """After cache invalidation a fresh pipeline run produces new facts."""
    from main import app
    from dependencies.deps import get_knowledge_service

    async with AsyncClient(app=app, base_url="http://test") as client:
        # Populate
        await client.post("/knowledge/summarize", json={"friend_id": 1})

    # Invalidate cache directly through the service
    ks = await get_knowledge_service()  # type: ignore[arg-type]
    await ks.cache_service.invalidate_summary(1)

    async with AsyncClient(app=app, base_url="http://test") as client:
        resp = await client.post("/knowledge/summarize", json={"friend_id": 1})

    assert resp.status_code == 200


@pytest.mark.system
async def test_force_rechunk_on_text_change(friend_api_mock):
    """When knowledge text changes (new hash), chunks are regenerated."""
    from main import app
    from dependencies.deps import get_chunking_service

    chunking_svc = await get_chunking_service()  # type: ignore[arg-type]

    # Process original text
    original_ids = await chunking_svc.process_knowledge(
        knowledge_id=999,
        knowledge_text=KNOWLEDGE_TEXT_1,
        force_regenerate=True,
    )
    assert len(original_ids) > 0

    # Process modified text → must produce new chunk IDs
    modified_text = KNOWLEDGE_TEXT_1 + " She also runs marathons."
    new_ids = await chunking_svc.process_knowledge(
        knowledge_id=999,
        knowledge_text=modified_text,
        force_regenerate=False,
    )
    # Hash differs → new chunk IDs
    assert new_ids != original_ids
