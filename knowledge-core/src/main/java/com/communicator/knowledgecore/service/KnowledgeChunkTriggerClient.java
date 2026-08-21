package com.communicator.knowledgecore.service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;

import org.springframework.amqp.rabbit.connection.CorrelationData;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import com.communicator.knowledgecore.config.RabbitMqConfig;
import com.communicator.knowledgecore.event.KnowledgeChunkTriggerEvent;
import com.fasterxml.jackson.databind.ObjectMapper;

import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;

/**
 * Fires the eager chunk-trigger for a Friend/Group/Connection KnowledgeService add/update
 * commit onto RabbitMQ's durable {@code knowledge.chunk.trigger} queue (ai_agent's aio-pika
 * consumer, see ai_agent/services/rabbitmq_consumer.py).
 *
 * Replaces the old direct fire-and-forget HTTP POST to ai_agent's {@code /knowledge/chunk} —
 * that endpoint still exists (manual/direct triggering), but the JVM side no longer calls it
 * as the primary path, since a lost HTTP call meant permanently-zero chunks for Group/
 * Connection knowledge (no lazy fallback exists for those two, unlike Friend). A durable queue
 * survives ai_agent being down at publish time; RabbitMQ redelivers once a consumer reconnects.
 *
 * {@code RabbitTemplate.convertAndSend} itself doesn't block on the network round trip (it
 * writes to the channel and returns), so this keeps the same "never blocks the caller" contract
 * the HTTP version had. Publisher confirms are enabled (see application.yml
 * spring.rabbitmq.publisher-confirm-type) so we can tell whether the broker actually persisted
 * the message — {@link #handleConfirm} runs asynchronously off the confirm listener thread, not
 * the AFTER_COMMIT thread that called {@link #triggerChunk}. A negative confirm (broker never
 * durably received the message — e.g. connection dropped mid-publish) is the one case still
 * worth falling back to the old direct HTTP call, since it means the message never even reached
 * the durable layer this whole change exists to add; a positive confirm degrades to a debug log.
 */
@Component
@Slf4j
public class KnowledgeChunkTriggerClient {

    private final RabbitTemplate rabbitTemplate;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .build();
    private final String aiAgentBaseUrl;

    // Keyed by CorrelationData id so handleConfirm can find the event that needs an HTTP
    // fallback on a negative confirm. Entries are removed on confirm; if a confirm never
    // arrives at all (e.g. channel closed uncleanly) an entry can linger — acceptable, same
    // best-effort tolerance the rest of this best-effort trigger already has.
    private final Map<String, KnowledgeChunkTriggerEvent> pendingConfirms = new ConcurrentHashMap<>();

    public KnowledgeChunkTriggerClient(
            RabbitTemplate rabbitTemplate,
            ObjectMapper objectMapper,
            @Value("${ai-agent.url:http://ai-agent:8001}") String aiAgentBaseUrl) {
        this.rabbitTemplate = rabbitTemplate;
        this.objectMapper = objectMapper;
        this.aiAgentBaseUrl = aiAgentBaseUrl;
    }

    @PostConstruct
    void registerConfirmCallback() {
        // Global on this RabbitTemplate bean — fine while this is the only publisher in the
        // app; if a second unrelated queue starts publishing through the same template later,
        // this callback needs to become correlation-id-namespaced (it already is keyed by our
        // own UUIDs, so collisions are practically impossible, just flagging the assumption).
        rabbitTemplate.setConfirmCallback(this::handleConfirm);
    }

    public void triggerChunk(KnowledgeChunkTriggerEvent event) {
        try {
            String body = objectMapper.writeValueAsString(toPayload(event));
            String correlationId = UUID.randomUUID().toString();
            CorrelationData correlationData = new CorrelationData(correlationId);
            pendingConfirms.put(correlationId, event);

            // Explicit (Object) cast: RabbitTemplate overloads convertAndSend(queue, message,
            // correlationData) and convertAndSend(exchange, routingKey, message) both accept
            // (String, String-compatible-Object) and are otherwise ambiguous for a String body.
            rabbitTemplate.convertAndSend(RabbitMqConfig.KNOWLEDGE_CHUNK_TRIGGER_QUEUE, (Object) body, correlationData);
        } catch (Exception e) {
            // Covers JSON serialization failures, a fully-unreachable broker (convertAndSend
            // throws AmqpException synchronously when there's no connection at all), and any
            // other synchronous setup error — must never propagate out of here or block/fail
            // the knowledge save that published this event.
            log.warn("Failed to publish chunk-trigger to RabbitMQ for knowledge {} ({}): {} — falling back to HTTP",
                    event.knowledgeId(), event.sourceType(), e.getMessage());
            fallbackToHttp(event);
        }
    }

    /** RabbitTemplate's confirm callback — invoked asynchronously once the broker ack/nacks. */
    void handleConfirm(CorrelationData correlationData, boolean ack, String cause) {
        if (correlationData == null) {
            return;
        }
        KnowledgeChunkTriggerEvent event = pendingConfirms.remove(correlationData.getId());
        if (event == null) {
            return;
        }
        if (ack) {
            log.debug("Chunk-trigger publish confirmed by broker for knowledge {} ({})",
                    event.knowledgeId(), event.sourceType());
        } else {
            log.warn("Chunk-trigger publish NOT confirmed by broker for knowledge {} ({}): {} — falling back to HTTP",
                    event.knowledgeId(), event.sourceType(), cause);
            fallbackToHttp(event);
        }
    }

    /**
     * The pre-RabbitMQ direct HTTP POST, kept only as the confirm-failure fallback. Same
     * timeouts/never-throws contract it always had.
     */
    private void fallbackToHttp(KnowledgeChunkTriggerEvent event) {
        try {
            String body = objectMapper.writeValueAsString(toPayload(event));

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(aiAgentBaseUrl + "/knowledge/chunk"))
                    .timeout(Duration.ofSeconds(15))
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(body))
                    .build();

            httpClient.sendAsync(request, HttpResponse.BodyHandlers.discarding())
                    .orTimeout(20, TimeUnit.SECONDS)
                    .whenComplete((response, error) -> {
                        if (error != null) {
                            log.warn("Chunk-trigger HTTP fallback failed for knowledge {} ({}): {}",
                                    event.knowledgeId(), event.sourceType(), error.getMessage());
                        } else if (response.statusCode() >= 300) {
                            log.warn("Chunk-trigger HTTP fallback for knowledge {} ({}) returned HTTP {}",
                                    event.knowledgeId(), event.sourceType(), response.statusCode());
                        }
                    });
        } catch (Exception e) {
            log.warn("Chunk-trigger HTTP fallback dispatch failed for knowledge {} ({}): {}",
                    event.knowledgeId(), event.sourceType(), e.getMessage());
        }
    }

    private Map<String, Object> toPayload(KnowledgeChunkTriggerEvent event) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("knowledge_id", event.knowledgeId());
        payload.put("source_type", event.sourceType());
        payload.put("friend_id", event.friendId());
        payload.put("group_id", event.groupId());
        payload.put("connection_friend1_id", event.connectionFriend1Id());
        payload.put("connection_friend2_id", event.connectionFriend2Id());
        payload.put("text", event.text());
        return payload;
    }
}
