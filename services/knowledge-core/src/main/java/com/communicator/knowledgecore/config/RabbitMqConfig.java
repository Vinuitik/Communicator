package com.communicator.knowledgecore.config;

import org.springframework.amqp.core.Queue;
import org.springframework.amqp.core.QueueBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Declares the durable queue KnowledgeChunkTriggerClient publishes onto (replacing the old
 * fire-and-forget HTTP POST to ai_agent) and its dead-letter queue.
 *
 * Naming: this is the first RabbitMQ producer/consumer wired up anywhere in this codebase
 * (RabbitMQ itself was already provisioned in docker-compose.yml — "durable task queue... no
 * producer/consumer appears" per the ai_agent PROTO gotchas, and KnowledgeChunkTriggerClient's
 * own old docstring — "deliberately not wired for this kind of trigger yet"). No existing
 * queue-naming convention to match, so `knowledge.chunk.trigger` / `.dlq` (dot-namespaced,
 * mirrors the REST path `/knowledge/chunk` this replaces).
 *
 * Both queue beans are declared here (JVM side) so RabbitAdmin auto-declares them on
 * connection-open regardless of which side (this app or ai_agent's aio-pika consumer) starts
 * first — ai_agent's consumer also idempotently declares the same two queues for the same
 * reason (declaration must match exactly or RabbitMQ raises PRECONDITION_FAILED).
 *
 * Retry-cap + DLQ routing is NOT done via native AMQP dead-lettering (x-dead-letter-exchange +
 * TTL-requeue cycling) — the consumer lives in ai_agent (aio-pika, not Spring Rabbit, so no
 * RepublishMessageRecoverer available) and explicitly re-publishes with an incremented
 * `x-retry-count` header on failure, routing to the DLQ once that count hits the cap. See
 * ai_agent/services/rabbitmq_consumer.py.
 */
@Configuration
public class RabbitMqConfig {

    public static final String KNOWLEDGE_CHUNK_TRIGGER_QUEUE = "knowledge.chunk.trigger";
    public static final String KNOWLEDGE_CHUNK_TRIGGER_DLQ = "knowledge.chunk.trigger.dlq";

    @Bean
    public Queue knowledgeChunkTriggerQueue() {
        return QueueBuilder.durable(KNOWLEDGE_CHUNK_TRIGGER_QUEUE).build();
    }

    @Bean
    public Queue knowledgeChunkTriggerDlq() {
        return QueueBuilder.durable(KNOWLEDGE_CHUNK_TRIGGER_DLQ).build();
    }
}
