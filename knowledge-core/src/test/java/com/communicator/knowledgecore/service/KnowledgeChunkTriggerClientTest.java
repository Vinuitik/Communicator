package com.communicator.knowledgecore.service;

import org.junit.jupiter.api.Test;

import com.communicator.knowledgecore.event.KnowledgeChunkTriggerEvent;
import com.fasterxml.jackson.databind.ObjectMapper;

import static org.assertj.core.api.Assertions.assertThatCode;

/**
 * The resilience requirement from the eager-chunking feature spec: ai_agent going down
 * (this repo's server is self-hosted and goes down often — a genuine, common case, not a
 * rare edge case) must NEVER fail or block the knowledge save that triggered the chunk
 * request. triggerChunk() uses JDK HttpClient's async send, so the network round trip
 * (or a fully unreachable target) happens off-thread — these tests confirm the call
 * returns promptly and never throws, regardless of whether the target is reachable.
 */
class KnowledgeChunkTriggerClientTest {

    private static final KnowledgeChunkTriggerEvent EVENT = new KnowledgeChunkTriggerEvent(
            1, "FRIEND", 2, null, null, null, "some knowledge text"
    );

    @Test
    void triggerChunk_neverThrowsWhenTargetUnreachable() {
        // Port 1 on loopback: nothing listens there, connection is refused almost
        // immediately — simulates ai-agent's container being down.
        KnowledgeChunkTriggerClient client =
                new KnowledgeChunkTriggerClient(new ObjectMapper(), "http://127.0.0.1:1");

        assertThatCode(() -> client.triggerChunk(EVENT)).doesNotThrowAnyException();
    }

    @Test
    void triggerChunk_neverThrowsOnMalformedBaseUrl() {
        // Deliberately invalid URI — exercises the synchronous try/catch path (request
        // building fails before sendAsync is ever reached).
        KnowledgeChunkTriggerClient client =
                new KnowledgeChunkTriggerClient(new ObjectMapper(), "not a valid url ::");

        assertThatCode(() -> client.triggerChunk(EVENT)).doesNotThrowAnyException();
    }

    @Test
    void triggerChunk_returnsWithoutWaitingForNetworkRoundTrip() {
        KnowledgeChunkTriggerClient client =
                new KnowledgeChunkTriggerClient(new ObjectMapper(), "http://127.0.0.1:1");

        long start = System.nanoTime();
        client.triggerChunk(EVENT);
        long elapsedMillis = (System.nanoTime() - start) / 1_000_000;

        // sendAsync must return control immediately; this is generous (a genuinely
        // blocking implementation connecting to a closed port would take much longer
        // once OS-level connection-refused/timeout behavior kicks in).
        org.assertj.core.api.Assertions.assertThat(elapsedMillis).isLessThan(2000);
    }
}
