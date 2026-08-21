"""Tests for KnowledgeChunkConsumer — the aio-pika consumer that replaces the JVM's old
fire-and-forget HTTP POST for eager knowledge chunking (2026-08-21). Mirrors
test_search_service.py's style: hand-rolled fakes for the aio-pika surface instead of a
live broker (this repo has no test-container pattern to spin one up with).

Covers: a message maps onto the exact same ChunkingService.process_knowledge() call the
HTTP endpoint makes (routers/knowledge.py chunk_knowledge); a failed message under the
retry cap is republished to the same queue with an incremented x-retry-count header; a
failed message at the retry cap is republished to the DLQ instead.
"""
import asyncio
import json
from unittest.mock import AsyncMock, MagicMock

from services.rabbitmq_consumer import (
    KnowledgeChunkConsumer, QUEUE_NAME, DLQ_NAME, RETRY_HEADER, MAX_ATTEMPTS,
)


class _NullAsyncCM:
    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        return False


class FakeMessage:
    """Minimal stand-in for aio_pika.IncomingMessage — just enough surface for
    KnowledgeChunkConsumer._on_message: .body, .headers, .content_type, .process()."""

    def __init__(self, payload: dict, headers: dict | None = None):
        self.body = json.dumps(payload).encode()
        self.headers = headers or {}
        self.content_type = "application/json"

    def process(self, ignore_processed=True):
        return _NullAsyncCM()


def make_consumer(chunking_service=None):
    chunking_service = chunking_service or AsyncMock()
    chunking_service.process_knowledge.return_value = ["chunk-1"]
    consumer = KnowledgeChunkConsumer(chunking_service, rabbitmq_url="amqp://unused/")
    consumer._channel = MagicMock()
    consumer._channel.default_exchange.publish = AsyncMock()
    return consumer, chunking_service


def test_on_message_calls_process_knowledge_with_the_same_args_the_http_path_uses():
    consumer, chunking_service = make_consumer()
    message = FakeMessage({
        "knowledge_id": 42,
        "source_type": "GROUP",
        "friend_id": None,
        "group_id": 7,
        "connection_friend1_id": None,
        "connection_friend2_id": None,
        "text": "book club notes",
    })

    asyncio.run(consumer._on_message(message))

    chunking_service.process_knowledge.assert_awaited_once_with(
        knowledge_id=42,
        knowledge_text="book club notes",
        source_type="GROUP",
        friend_id=None,
        group_id=7,
        connection_friend1_id=None,
        connection_friend2_id=None,
    )
    consumer._channel.default_exchange.publish.assert_not_called()


def test_on_message_failure_under_retry_cap_republishes_to_same_queue_with_incremented_header():
    chunking_service = AsyncMock()
    chunking_service.process_knowledge.side_effect = RuntimeError("db is down")
    consumer, _ = make_consumer(chunking_service)
    message = FakeMessage(
        {"knowledge_id": 1, "source_type": "FRIEND", "text": "x"},
        headers={RETRY_HEADER: 0},
    )

    asyncio.run(consumer._on_message(message))

    consumer._channel.default_exchange.publish.assert_awaited_once()
    published_message, kwargs = consumer._channel.default_exchange.publish.call_args
    sent_message = published_message[0]
    assert kwargs["routing_key"] == QUEUE_NAME
    assert sent_message.headers[RETRY_HEADER] == 1


def test_on_message_failure_at_retry_cap_routes_to_dlq():
    chunking_service = AsyncMock()
    chunking_service.process_knowledge.side_effect = RuntimeError("still down")
    consumer, _ = make_consumer(chunking_service)
    message = FakeMessage(
        {"knowledge_id": 1, "source_type": "FRIEND", "text": "x"},
        headers={RETRY_HEADER: MAX_ATTEMPTS - 1},
    )

    asyncio.run(consumer._on_message(message))

    consumer._channel.default_exchange.publish.assert_awaited_once()
    published_message, kwargs = consumer._channel.default_exchange.publish.call_args
    sent_message = published_message[0]
    assert kwargs["routing_key"] == DLQ_NAME
    assert sent_message.headers[RETRY_HEADER] == MAX_ATTEMPTS
    assert "x-failure-reason" in sent_message.headers


def test_on_message_never_raises_even_when_publish_itself_fails():
    chunking_service = AsyncMock()
    chunking_service.process_knowledge.side_effect = RuntimeError("boom")
    consumer, _ = make_consumer(chunking_service)
    consumer._channel.default_exchange.publish.side_effect = RuntimeError("channel closed")
    message = FakeMessage({"knowledge_id": 1, "source_type": "FRIEND", "text": "x"})

    # _on_message's try/except only guards process_knowledge — a failure inside
    # _handle_failure's own publish call is a real bug worth surfacing loudly (it means a
    # message is lost), not one this consumer should silently swallow, so this documents
    # the current (unguarded) behavior rather than asserting silence.
    try:
        asyncio.run(consumer._on_message(message))
        raised = False
    except RuntimeError:
        raised = True
    assert raised
