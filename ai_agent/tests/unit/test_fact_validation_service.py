"""Unit tests for FactValidationService."""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from services.fact_validation_service import FactValidationService


def _make_service(agent_service=None, *, min_confidence=0.8):
    agent_service = agent_service or AsyncMock()
    with patch("services.fact_validation_service.settings") as s:
        s.min_validation_confidence = min_confidence
        return FactValidationService(agent_service=agent_service)


# ---------------------------------------------------------------------------
# validate_fact
# ---------------------------------------------------------------------------

@pytest.mark.unit
async def test_validate_fact_valid_json_returns_true(mock_agent_service):
    mock_agent_service.generate_response = AsyncMock(
        return_value='{"is_valid": true, "confidence": 0.9, "reasoning": "Supported."}'
    )
    svc = _make_service(mock_agent_service)
    is_valid, confidence, reasoning = await svc.validate_fact(
        "Hobbies", "Hiking", ["Alice loves hiking."]
    )
    assert is_valid is True
    assert confidence == pytest.approx(0.9)
    assert "Supported" in reasoning


@pytest.mark.unit
async def test_validate_fact_invalid_returns_false(mock_agent_service):
    mock_agent_service.generate_response = AsyncMock(
        return_value='{"is_valid": false, "confidence": 0.2, "reasoning": "Not found."}'
    )
    svc = _make_service(mock_agent_service)
    is_valid, confidence, _ = await svc.validate_fact("Pets", "Dog", ["Alice has cats."])
    assert is_valid is False
    assert confidence == pytest.approx(0.2)


@pytest.mark.unit
async def test_validate_fact_strips_markdown_json_code_block(mock_agent_service):
    response = "```json\n{\"is_valid\": true, \"confidence\": 0.95, \"reasoning\": \"Yes.\"}\n```"
    mock_agent_service.generate_response = AsyncMock(return_value=response)
    svc = _make_service(mock_agent_service)
    is_valid, confidence, _ = await svc.validate_fact("Key", "Value", ["text"])
    assert is_valid is True
    assert confidence == pytest.approx(0.95)


@pytest.mark.unit
async def test_validate_fact_strips_plain_code_block(mock_agent_service):
    response = "```\n{\"is_valid\": false, \"confidence\": 0.1, \"reasoning\": \"No.\"}\n```"
    mock_agent_service.generate_response = AsyncMock(return_value=response)
    svc = _make_service(mock_agent_service)
    is_valid, confidence, _ = await svc.validate_fact("K", "V", ["t"])
    assert is_valid is False


@pytest.mark.unit
async def test_validate_fact_malformed_json_returns_false(mock_agent_service):
    mock_agent_service.generate_response = AsyncMock(
        return_value="This is not JSON at all!"
    )
    svc = _make_service(mock_agent_service)
    is_valid, confidence, reasoning = await svc.validate_fact("K", "V", ["t"])
    assert is_valid is False
    assert confidence == 0.0
    assert "parse" in reasoning.lower() or "error" in reasoning.lower()


@pytest.mark.unit
async def test_validate_fact_llm_exception_returns_false(mock_agent_service):
    mock_agent_service.generate_response = AsyncMock(side_effect=RuntimeError("LLM unavailable"))
    svc = _make_service(mock_agent_service)
    is_valid, confidence, reasoning = await svc.validate_fact("K", "V", ["t"])
    assert is_valid is False
    assert confidence == 0.0
    assert "error" in reasoning.lower() or "validation" in reasoning.lower()


@pytest.mark.unit
async def test_validate_fact_missing_keys_defaults_to_false(mock_agent_service):
    # Response missing 'is_valid' key
    mock_agent_service.generate_response = AsyncMock(
        return_value='{"confidence": 0.9, "reasoning": "ok"}'
    )
    svc = _make_service(mock_agent_service)
    is_valid, confidence, _ = await svc.validate_fact("K", "V", ["t"])
    assert is_valid is False  # defaults to False when key absent


# ---------------------------------------------------------------------------
# meets_threshold / get_min_confidence
# ---------------------------------------------------------------------------

@pytest.mark.unit
def test_meets_threshold_above():
    svc = _make_service(min_confidence=0.8)
    assert svc.meets_threshold(0.9) is True


@pytest.mark.unit
def test_meets_threshold_below():
    svc = _make_service(min_confidence=0.8)
    assert svc.meets_threshold(0.7) is False


@pytest.mark.unit
def test_meets_threshold_exact_boundary():
    svc = _make_service(min_confidence=0.8)
    assert svc.meets_threshold(0.8) is True


@pytest.mark.unit
def test_get_min_confidence_from_settings():
    svc = _make_service(min_confidence=0.75)
    assert svc.get_min_confidence() == pytest.approx(0.75)
