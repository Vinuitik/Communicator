package com.communicator.knowledgecore.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.communicator.knowledgecore.event.KnowledgeChunkTriggerEvent;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;

/**
 * Belt-and-suspenders half of the resilience requirement: even if
 * KnowledgeChunkTriggerClient itself somehow throws synchronously (it shouldn't — see
 * KnowledgeChunkTriggerClientTest — but the listener doesn't get to assume that), the
 * AFTER_COMMIT listener must swallow it rather than let it propagate, since Spring's
 * TransactionalEventListener has already left the publishing transaction's lifecycle by
 * this point.
 */
@ExtendWith(MockitoExtension.class)
class KnowledgeChunkTriggerListenerTest {

    @Mock KnowledgeChunkTriggerClient client;

    @Test
    void onKnowledgeChunkTrigger_delegatesToClient() {
        KnowledgeChunkTriggerListener listener = new KnowledgeChunkTriggerListener(client);
        KnowledgeChunkTriggerEvent event = new KnowledgeChunkTriggerEvent(1, "FRIEND", 2, null, null, null, "text");

        listener.onKnowledgeChunkTrigger(event);

        verify(client).triggerChunk(event);
    }

    @Test
    void onKnowledgeChunkTrigger_neverThrowsWhenClientThrows() {
        KnowledgeChunkTriggerListener listener = new KnowledgeChunkTriggerListener(client);
        KnowledgeChunkTriggerEvent event = new KnowledgeChunkTriggerEvent(1, "GROUP", null, 3, null, null, "text");
        doThrow(new RuntimeException("ai-agent unreachable")).when(client).triggerChunk(any());

        assertThatCode(() -> listener.onKnowledgeChunkTrigger(event)).doesNotThrowAnyException();
    }
}
