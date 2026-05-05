"""Unit tests for ChunkingService.

Pure-logic methods are tested directly.
Repository and EmbeddingService dependencies are replaced with AsyncMocks.
"""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch, call

from services.chunking_service import ChunkingService


def _make_service(chunk_repo=None, embedding_repo=None, embedding_service=None, *,
                  chunk_size=10, overlap=2, min_size=5):
    chunk_repo = chunk_repo or AsyncMock()
    embedding_repo = embedding_repo or MagicMock()
    embedding_service = embedding_service or AsyncMock()

    with patch("services.chunking_service.settings") as s:
        s.chunk_size_words = chunk_size
        s.chunk_overlap_words = overlap
        s.min_chunk_size_words = min_size
        s.chunking_mode = "eager"
        s.embedding_model = "test-model"
        return ChunkingService(embedding_service, chunk_repo, embedding_repo)


# ---------------------------------------------------------------------------
# _split_into_chunks
# ---------------------------------------------------------------------------

@pytest.mark.unit
def test_split_short_text_single_chunk():
    svc = _make_service(chunk_size=10, overlap=2, min_size=5)
    # 3 words → below min_size=5 → single chunk
    text = "one two three"
    chunks = svc._split_into_chunks(text)
    assert len(chunks) == 1
    chunk_text, start, end = chunks[0]
    assert chunk_text == text
    assert start == 0
    assert end == len(text)


@pytest.mark.unit
def test_split_exact_chunk_size_single_chunk():
    svc = _make_service(chunk_size=5, overlap=1, min_size=3)
    words = ["word"] * 5
    text = " ".join(words)
    chunks = svc._split_into_chunks(text)
    assert len(chunks) == 1


@pytest.mark.unit
def test_split_overlap_produces_multiple_chunks():
    svc = _make_service(chunk_size=4, overlap=1, min_size=2)
    # 7 words → first chunk 0-3, second chunk starts at 3 (4-1=3)
    text = "a b c d e f g"
    chunks = svc._split_into_chunks(text)
    assert len(chunks) >= 2


@pytest.mark.unit
def test_split_char_positions_slice_matches_text():
    svc = _make_service(chunk_size=4, overlap=1, min_size=2)
    text = "alpha beta gamma delta epsilon zeta eta"
    chunks = svc._split_into_chunks(text)
    for chunk_text, char_start, char_end in chunks:
        assert text[char_start:char_end] == chunk_text


# ---------------------------------------------------------------------------
# _calculate_text_hash
# ---------------------------------------------------------------------------

@pytest.mark.unit
def test_calculate_text_hash_deterministic():
    svc = _make_service()
    assert svc._calculate_text_hash("hello") == svc._calculate_text_hash("hello")


@pytest.mark.unit
def test_calculate_text_hash_different_for_different_texts():
    svc = _make_service()
    assert svc._calculate_text_hash("foo") != svc._calculate_text_hash("bar")


# ---------------------------------------------------------------------------
# _generate_chunk_id
# ---------------------------------------------------------------------------

@pytest.mark.unit
def test_generate_chunk_id_format():
    svc = _make_service()
    chunk_id = svc._generate_chunk_id(knowledge_id=42, chunk_index=0, text_hash="abcdef1234567890")
    assert chunk_id == "chunk_42_0_abcdef12"


# ---------------------------------------------------------------------------
# process_knowledge
# ---------------------------------------------------------------------------

@pytest.mark.unit
async def test_process_knowledge_cache_hit_returns_existing_ids(
    mock_chunk_repo, mock_embedding_repo, mock_embedding_service
):
    existing = [{"chunk_id": "chunk_1_0_abc12345"}, {"chunk_id": "chunk_1_1_abc12345"}]
    mock_chunk_repo.find_chunks_by_knowledge_and_hash = AsyncMock(return_value=existing)

    svc = _make_service(mock_chunk_repo, mock_embedding_repo, mock_embedding_service)
    chunk_ids = await svc.process_knowledge(
        knowledge_id=1,
        knowledge_text="word " * 20,
        force_regenerate=False,
    )

    assert chunk_ids == ["chunk_1_0_abc12345", "chunk_1_1_abc12345"]
    mock_embedding_service.embed_texts.assert_not_called()


@pytest.mark.unit
async def test_process_knowledge_new_text_creates_chunks_and_embeddings(
    mock_chunk_repo, mock_embedding_repo, mock_embedding_service
):
    mock_chunk_repo.find_chunks_by_knowledge_and_hash = AsyncMock(return_value=[])
    mock_chunk_repo.create_chunk_documents = MagicMock(
        return_value=(
            [{"chunk_id": "chunk_1_0_neww1234"}],
            ["some chunk text"],
            ["chunk_1_0_neww1234"],
        )
    )
    mock_embedding_repo.create_embedding_documents = MagicMock(return_value=[{"chunk_id": "chunk_1_0_neww1234"}])
    mock_embedding_service.embed_texts = AsyncMock(return_value=[[0.1] * 384])
    mock_embedding_service.get_embedding_dimension = MagicMock(return_value=384)

    svc = _make_service(mock_chunk_repo, mock_embedding_repo, mock_embedding_service)
    chunk_ids = await svc.process_knowledge(
        knowledge_id=1,
        knowledge_text="word " * 20,
    )

    assert chunk_ids == ["chunk_1_0_neww1234"]
    mock_chunk_repo.save_chunks.assert_called_once()
    mock_embedding_repo.save_embeddings.assert_called_once()


@pytest.mark.unit
async def test_process_knowledge_force_regenerate_bypasses_cache(
    mock_chunk_repo, mock_embedding_repo, mock_embedding_service
):
    # Even if chunks exist, force_regenerate=True should re-process
    existing = [{"chunk_id": "old_chunk"}]
    mock_chunk_repo.find_chunks_by_knowledge_and_hash = AsyncMock(return_value=existing)
    mock_chunk_repo.create_chunk_documents = MagicMock(
        return_value=([{"chunk_id": "new_chunk"}], ["text"], ["new_chunk"])
    )
    mock_embedding_repo.create_embedding_documents = MagicMock(return_value=[{}])
    mock_embedding_service.embed_texts = AsyncMock(return_value=[[0.1] * 384])
    mock_embedding_service.get_embedding_dimension = MagicMock(return_value=384)

    svc = _make_service(mock_chunk_repo, mock_embedding_repo, mock_embedding_service)
    await svc.process_knowledge(1, "word " * 20, force_regenerate=True)

    mock_chunk_repo.delete_chunks_and_embeddings.assert_called_once_with(1)


# ---------------------------------------------------------------------------
# get_chunk_text
# ---------------------------------------------------------------------------

@pytest.mark.unit
async def test_get_chunk_text_returns_correct_slice(mock_chunk_repo):
    full_text = "The quick brown fox jumps over the lazy dog"
    mock_chunk_repo.find_chunk_by_id = AsyncMock(
        return_value={"chunk_id": "c1", "char_start": 4, "char_end": 9}
    )
    svc = _make_service(chunk_repo=mock_chunk_repo)
    result = await svc.get_chunk_text("c1", full_text)
    assert result == full_text[4:9]


@pytest.mark.unit
async def test_get_chunk_text_missing_chunk_raises(mock_chunk_repo):
    mock_chunk_repo.find_chunk_by_id = AsyncMock(return_value=None)
    svc = _make_service(chunk_repo=mock_chunk_repo)
    with pytest.raises(ValueError, match="not found"):
        await svc.get_chunk_text("nonexistent", "some text")


# ---------------------------------------------------------------------------
# ensure_embeddings_exist
# ---------------------------------------------------------------------------

@pytest.mark.unit
async def test_ensure_embeddings_all_exist_returns_zero(
    mock_chunk_repo, mock_embedding_repo, mock_embedding_service
):
    mock_chunk_repo.find_chunks_missing_embeddings = AsyncMock(return_value=[])
    svc = _make_service(mock_chunk_repo, mock_embedding_repo, mock_embedding_service)
    count = await svc.ensure_embeddings_exist(["c1", "c2"], {1: "text"})
    assert count == 0
    mock_embedding_service.embed_texts.assert_not_called()


@pytest.mark.unit
async def test_ensure_embeddings_generates_missing(
    mock_chunk_repo, mock_embedding_repo, mock_embedding_service
):
    missing_ids = ["c3", "c4"]
    mock_chunk_repo.find_chunks_missing_embeddings = AsyncMock(return_value=missing_ids)
    mock_chunk_repo.find_chunks_by_ids = AsyncMock(return_value=[
        {"chunk_id": "c3", "knowledge_id": 1, "char_start": 0, "char_end": 5},
        {"chunk_id": "c4", "knowledge_id": 1, "char_start": 6, "char_end": 11},
    ])
    mock_embedding_service.embed_texts = AsyncMock(return_value=[[0.1]*384, [0.2]*384])
    mock_embedding_service.get_embedding_dimension = MagicMock(return_value=384)
    mock_embedding_repo.create_embedding_documents = MagicMock(return_value=[{}, {}])

    svc = _make_service(mock_chunk_repo, mock_embedding_repo, mock_embedding_service)
    count = await svc.ensure_embeddings_exist(["c3", "c4"], {1: "hello world today"})

    assert count == 2
    mock_embedding_repo.save_embeddings.assert_called_once()
