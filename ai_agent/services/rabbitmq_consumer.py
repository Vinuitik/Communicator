"""aio-pika consumer for the knowledge chunk-trigger queue.

The JVM's KnowledgeChunkTriggerClient (knowledge-core module) publishes onto RabbitMQ's
durable `knowledge.chunk.trigger` queue after a Friend/Group/Connection KnowledgeService
save commits (replacing the old fire-and-forget HTTP POST to POST /knowledge/chunk — that
endpoint, routers/knowledge.py chunk_knowledge, still exists for direct/manual triggering).
This consumer calls the exact same ChunkingService.process_knowledge() that endpoint calls,
so the chunking logic itself lives in exactly one place regardless of which path triggered it.

Async-native (aio-pika, not pika/kombu) since this whole service is FastAPI/asyncio already.

Retry-cap + DLQ: this consumer, not native AMQP dead-lettering, owns the retry bookkeeping.
There's no Spring-Rabbit-style RepublishMessageRecoverer available in aio-pika, so a failed
message is explicitly re-published to the same queue with an incremented `x-retry-count`
header; once that count reaches MAX_ATTEMPTS the message is re-published to
`knowledge.chunk.trigger.dlq` instead. The original delivery is always acked either way (a
replacement message has already been published in its place) — see _on_message.
"""
import asyncio
import json
import logging
from typing import Optional

import aio_pika

from config.settings import settings
from services.chunking_service import ChunkingService

logger = logging.getLogger(__name__)

QUEUE_NAME = "knowledge.chunk.trigger"
DLQ_NAME = "knowledge.chunk.trigger.dlq"
RETRY_HEADER = "x-retry-count"
MAX_ATTEMPTS = 3  # matches the retry cap called out in the task spec; no existing
                   # per-attempt-ledger convention elsewhere in this codebase to match instead
                   # (outbox-core's ConsumedWriteRequest is idempotency, not a retry counter).


class KnowledgeChunkConsumer:
    """Owns the aio-pika connection/channel lifecycle for the chunk-trigger queue."""

    def __init__(self, chunking_service: ChunkingService, rabbitmq_url: Optional[str] = None,
                 max_connect_attempts: int = 5, retry_delay_seconds: int = 3):
        self.chunking_service = chunking_service
        self.rabbitmq_url = rabbitmq_url or settings.rabbitmq_url
        self.max_connect_attempts = max_connect_attempts
        self.retry_delay_seconds = retry_delay_seconds
        self._connection: Optional[aio_pika.RobustConnection] = None
        self._channel: Optional[aio_pika.Channel] = None
        self._consume_task: Optional[asyncio.Task] = None

    async def start(self) -> None:
        """Connect (with a bounded retry loop, same spirit as MCPService's own startup
        retry) and start consuming in the background.

        Never raises — a RabbitMQ outage at startup must not crash ai-agent. Chat and
        summarize don't depend on this queue at all, and the direct POST /knowledge/chunk
        endpoint plus chrono's nightly reconciliation sweep both still work independently
        of whether this consumer is up.
        """
        for attempt in range(1, self.max_connect_attempts + 1):
            try:
                self._connection = await aio_pika.connect_robust(self.rabbitmq_url)
                self._channel = await self._connection.channel()
                await self._channel.set_qos(prefetch_count=10)

                # Idempotent declare — must match the JVM side's RabbitMqConfig bean
                # declarations exactly (durable, no other args) or RabbitMQ raises
                # PRECONDITION_FAILED regardless of which side connects first.
                queue = await self._channel.declare_queue(QUEUE_NAME, durable=True)
                await self._channel.declare_queue(DLQ_NAME, durable=True)

                self._consume_task = asyncio.create_task(queue.consume(self._on_message))
                logger.info(f"KnowledgeChunkConsumer connected and consuming from '{QUEUE_NAME}'")
                return
            except Exception as e:
                logger.warning(
                    f"KnowledgeChunkConsumer: RabbitMQ connect attempt {attempt}/{self.max_connect_attempts} "
                    f"failed: {e}"
                )
                if attempt < self.max_connect_attempts:
                    await asyncio.sleep(self.retry_delay_seconds)

        logger.error(
            f"KnowledgeChunkConsumer: could not connect to RabbitMQ after {self.max_connect_attempts} "
            "attempts — eager chunk-trigger queue consumption is DOWN for this process lifetime. "
            "POST /knowledge/chunk (direct) and chrono's nightly reconciliation sweep still cover "
            "this gap; queued triggers will sit unconsumed until RabbitMQ (or this connection) recovers."
        )

    async def stop(self) -> None:
        if self._consume_task is not None:
            self._consume_task.cancel()
        if self._connection is not None:
            await self._connection.close()

    async def _on_message(self, message: aio_pika.abc.AbstractIncomingMessage) -> None:
        # ignore_processed=True: we always decide ack/nack ourselves inside the try/except
        # below rather than let an unhandled exception escape the block (which would nack
        # without requeue and just silently drop the message — not what we want, we want
        # our own retry-then-DLQ republish instead).
        async with message.process(ignore_processed=True):
            attempt = self._read_attempt(message)
            try:
                payload = json.loads(message.body.decode())
                knowledge_id = payload["knowledge_id"]
                source_type = payload.get("source_type", "FRIEND")

                await self.chunking_service.process_knowledge(
                    knowledge_id=knowledge_id,
                    knowledge_text=payload["text"],
                    source_type=source_type,
                    friend_id=payload.get("friend_id"),
                    group_id=payload.get("group_id"),
                    connection_friend1_id=payload.get("connection_friend1_id"),
                    connection_friend2_id=payload.get("connection_friend2_id"),
                )
                logger.info(
                    f"KnowledgeChunkConsumer: chunked knowledge_id={knowledge_id} "
                    f"source_type={source_type} via RabbitMQ (attempt {attempt + 1})"
                )
            except Exception as e:
                logger.error(
                    f"KnowledgeChunkConsumer: failed to process message (attempt {attempt + 1}/{MAX_ATTEMPTS}): {e}",
                    exc_info=True,
                )
                await self._handle_failure(message, attempt, e)

    @staticmethod
    def _read_attempt(message: aio_pika.abc.AbstractIncomingMessage) -> int:
        headers = message.headers or {}
        try:
            return int(headers.get(RETRY_HEADER, 0))
        except (TypeError, ValueError):
            return 0

    async def _handle_failure(
        self, message: aio_pika.abc.AbstractIncomingMessage, attempt: int, error: Exception
    ) -> None:
        next_attempt = attempt + 1
        headers = dict(message.headers or {})
        headers[RETRY_HEADER] = next_attempt

        if next_attempt < MAX_ATTEMPTS:
            target = QUEUE_NAME
            logger.warning(f"KnowledgeChunkConsumer: requeueing for retry {next_attempt}/{MAX_ATTEMPTS}")
        else:
            target = DLQ_NAME
            headers["x-failure-reason"] = str(error)[:500]
            logger.error(
                f"KnowledgeChunkConsumer: exhausted {MAX_ATTEMPTS} attempts, routing to DLQ '{DLQ_NAME}': {error}"
            )

        await self._channel.default_exchange.publish(
            aio_pika.Message(
                body=message.body,
                headers=headers,
                delivery_mode=aio_pika.DeliveryMode.PERSISTENT,
                content_type=message.content_type,
            ),
            routing_key=target,
        )
