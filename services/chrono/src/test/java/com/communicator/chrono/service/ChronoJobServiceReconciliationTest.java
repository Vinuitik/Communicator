package com.communicator.chrono.service;

import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import org.springframework.jdbc.core.JdbcTemplate;

import com.communicator.chrono.config.ChronoProperties;
import com.communicator.knowledgecore.event.KnowledgeChunkTriggerEvent;
import com.communicator.knowledgecore.service.KnowledgeChunkTriggerClient;

import communicate.Friend.Config.EmaProperties;
import communicate.Friend.FriendService.AnalyticsService;
import communicate.Friend.FriendService.EmaMathService;
import communicate.Friend.FriendService.FlashcardBankruptcyService;
import communicate.Friend.FriendService.FlashcardReviewSettingsService;
import communicate.Friend.FriendService.FlashcardSpreadService;
import communicate.Friend.FriendService.FriendService;
import communicate.Friend.FriendService.FsrsNeglectService;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Reconciliation-query test for ChronoJobService.reconcileMissingKnowledgeChunks() — the
 * nightly backstop for the one gap RabbitMQ itself can't close (JVM crashing between the
 * knowledge-save DB commit and successfully publishing the chunk-trigger; commit+publish
 * aren't atomic). No test-container in this repo for a real Postgres, so JdbcTemplate is
 * mocked directly (same call-shape assertion style as the rest of this repo's unit tests,
 * e.g. KnowledgeChunkTriggerClientTest mocking RabbitTemplate).
 */
@ExtendWith(MockitoExtension.class)
class ChronoJobServiceReconciliationTest {

    @Mock JdbcTemplate jdbcTemplate;
    @Mock KnowledgeChunkTriggerClient knowledgeChunkTriggerClient;

    private ChronoJobService newService() {
        return new ChronoJobService(
                mock(FriendService.class),
                mock(AnalyticsService.class),
                mock(ChronoProperties.class),
                mock(EmaMathService.class),
                mock(EmaProperties.class),
                mock(FsrsNeglectService.class),
                mock(FlashcardBankruptcyService.class),
                mock(FlashcardSpreadService.class),
                mock(FlashcardReviewSettingsService.class),
                jdbcTemplate,
                knowledgeChunkTriggerClient
        );
    }

    @Test
    void republishesEachGroupKnowledgeRowWithZeroChunks() {
        when(jdbcTemplate.queryForList(anyString()))
                .thenReturn(List.of(Map.of("knowledge_id", 10, "group_id", 5, "text", "book club notes")))
                .thenReturn(List.of());

        newService().reconcileMissingKnowledgeChunks();

        ArgumentCaptor<KnowledgeChunkTriggerEvent> captor = ArgumentCaptor.forClass(KnowledgeChunkTriggerEvent.class);
        verify(knowledgeChunkTriggerClient).triggerChunk(captor.capture());
        KnowledgeChunkTriggerEvent event = captor.getValue();
        assertThat(event.knowledgeId()).isEqualTo(10);
        assertThat(event.sourceType()).isEqualTo("GROUP");
        assertThat(event.groupId()).isEqualTo(5);
        assertThat(event.friendId()).isNull();
        assertThat(event.text()).isEqualTo("book club notes");
    }

    @Test
    void republishesEachConnectionKnowledgeRowWithZeroChunks() {
        when(jdbcTemplate.queryForList(anyString()))
                .thenReturn(List.of())
                .thenReturn(List.of(Map.of(
                        "knowledge_id", 20, "friend1_id", 3L, "friend2_id", 8L, "text", "met at conference")));

        newService().reconcileMissingKnowledgeChunks();

        ArgumentCaptor<KnowledgeChunkTriggerEvent> captor = ArgumentCaptor.forClass(KnowledgeChunkTriggerEvent.class);
        verify(knowledgeChunkTriggerClient).triggerChunk(captor.capture());
        KnowledgeChunkTriggerEvent event = captor.getValue();
        assertThat(event.knowledgeId()).isEqualTo(20);
        assertThat(event.sourceType()).isEqualTo("CONNECTION");
        assertThat(event.connectionFriend1Id()).isEqualTo(3L);
        assertThat(event.connectionFriend2Id()).isEqualTo(8L);
        assertThat(event.text()).isEqualTo("met at conference");
    }

    @Test
    void doesNothingWhenNoRowsAreMissingChunks() {
        when(jdbcTemplate.queryForList(anyString())).thenReturn(List.of());

        newService().reconcileMissingKnowledgeChunks();

        verify(knowledgeChunkTriggerClient, org.mockito.Mockito.never()).triggerChunk(org.mockito.ArgumentMatchers.any());
    }

    @Test
    void queriesScopeToRowsWithNoMatchingChunkRow() {
        // Documents the invariant the query relies on (NOT EXISTS ... source_type match) —
        // a row WITH chunks must never be re-published. Verified at the SQL-text level since
        // there's no live Postgres in this test; the actual filtering behavior is Postgres's
        // to execute, this only guards the query shape doesn't regress to "select everything."
        when(jdbcTemplate.queryForList(anyString())).thenReturn(List.of());

        newService().reconcileMissingKnowledgeChunks();

        ArgumentCaptor<String> sqlCaptor = ArgumentCaptor.forClass(String.class);
        verify(jdbcTemplate, org.mockito.Mockito.times(2)).queryForList(sqlCaptor.capture());
        List<String> queries = sqlCaptor.getAllValues();
        assertThat(queries.get(0)).contains("group_knowledge", "NOT EXISTS", "source_type = 'GROUP'");
        assertThat(queries.get(1)).contains("connections_knowledge", "NOT EXISTS", "source_type = 'CONNECTION'");
    }
}
