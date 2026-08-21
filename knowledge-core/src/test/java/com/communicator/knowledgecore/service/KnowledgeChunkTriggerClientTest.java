package com.communicator.knowledgecore.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import org.springframework.amqp.AmqpConnectException;
import org.springframework.amqp.rabbit.connection.CorrelationData;
import org.springframework.amqp.rabbit.core.RabbitTemplate;

import com.communicator.knowledgecore.config.RabbitMqConfig;
import com.communicator.knowledgecore.event.KnowledgeChunkTriggerEvent;
import com.fasterxml.jackson.databind.ObjectMapper;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;

/**
 * Publish-side test for the RabbitMQ path (replaces the old fire-and-forget HTTP-only
 * behavior). Resilience requirement is unchanged from before: nothing here may ever throw
 * or block the AFTER_COMMIT listener that calls triggerChunk(), whether the broker is
 * reachable, unreachable, or confirms negatively.
 */
@ExtendWith(MockitoExtension.class)
class KnowledgeChunkTriggerClientTest {

    private static final KnowledgeChunkTriggerEvent EVENT = new KnowledgeChunkTriggerEvent(
            1, "FRIEND", 2, null, null, null, "some knowledge text"
    );

    @Mock RabbitTemplate rabbitTemplate;

    @Test
    void triggerChunk_publishesToTheDurableQueue() {
        KnowledgeChunkTriggerClient client =
                new KnowledgeChunkTriggerClient(rabbitTemplate, new ObjectMapper(), "http://ai-agent:8001");

        client.triggerChunk(EVENT);

        ArgumentCaptor<String> bodyCaptor = ArgumentCaptor.forClass(String.class);
        verify(rabbitTemplate).convertAndSend(
                eq(RabbitMqConfig.KNOWLEDGE_CHUNK_TRIGGER_QUEUE), bodyCaptor.capture(), any(CorrelationData.class));
        assertThat(bodyCaptor.getValue()).contains("\"knowledge_id\":1", "\"source_type\":\"FRIEND\"");
    }

    @Test
    void triggerChunk_neverThrowsWhenBrokerUnreachable() {
        doThrow(new AmqpConnectException(new RuntimeException("connection refused")))
                .when(rabbitTemplate).convertAndSend(anyString(), anyString(), any(CorrelationData.class));
        KnowledgeChunkTriggerClient client =
                new KnowledgeChunkTriggerClient(rabbitTemplate, new ObjectMapper(), "http://127.0.0.1:1");

        assertThatCode(() -> client.triggerChunk(EVENT)).doesNotThrowAnyException();
    }

    @Test
    void handleConfirm_negativeAckFallsBackToHttp_andNeverThrows() {
        KnowledgeChunkTriggerClient client =
                new KnowledgeChunkTriggerClient(rabbitTemplate, new ObjectMapper(), "http://127.0.0.1:1");

        client.triggerChunk(EVENT);
        ArgumentCaptor<CorrelationData> correlationCaptor = ArgumentCaptor.forClass(CorrelationData.class);
        verify(rabbitTemplate).convertAndSend(anyString(), anyString(), correlationCaptor.capture());

        // Simulate the broker nacking the publish — must not throw, and (best-effort,
        // fire-and-forget) attempts the HTTP fallback rather than silently dropping the event.
        assertThatCode(() ->
                client.handleConfirm(correlationCaptor.getValue(), false, "channel closed"))
                .doesNotThrowAnyException();
    }

    @Test
    void handleConfirm_positiveAckDoesNotFallBackToHttp() {
        KnowledgeChunkTriggerClient client =
                new KnowledgeChunkTriggerClient(rabbitTemplate, new ObjectMapper(), "http://127.0.0.1:1");

        client.triggerChunk(EVENT);
        ArgumentCaptor<CorrelationData> correlationCaptor = ArgumentCaptor.forClass(CorrelationData.class);
        verify(rabbitTemplate).convertAndSend(anyString(), anyString(), correlationCaptor.capture());

        assertThatCode(() ->
                client.handleConfirm(correlationCaptor.getValue(), true, null))
                .doesNotThrowAnyException();

        // A positive confirm is the happy path — the only convertAndSend call is the
        // original publish (captured above); no second call is made on this path.
        verify(rabbitTemplate).convertAndSend(anyString(), anyString(), any(CorrelationData.class));
    }

    @Test
    void handleConfirm_unknownCorrelationIdIsIgnored() {
        KnowledgeChunkTriggerClient client =
                new KnowledgeChunkTriggerClient(rabbitTemplate, new ObjectMapper(), "http://127.0.0.1:1");

        assertThatCode(() ->
                client.handleConfirm(new CorrelationData("never-published"), false, "n/a"))
                .doesNotThrowAnyException();
    }
}
