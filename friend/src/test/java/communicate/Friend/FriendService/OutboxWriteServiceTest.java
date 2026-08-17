package communicate.Friend.FriendService;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import communicate.Friend.FriendEntities.Analytics;
import communicate.Friend.FriendEntities.Friend;
import communicate.Friend.FriendEntities.FriendKnowledge;
import com.communicator.outboxcore.service.ConsumedWriteRequestService;
import jakarta.persistence.EntityNotFoundException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * The idempotency guarantee lives entirely in these three methods -- this is what
 * actually stops a retried/replayed offline-outbox write (react/src/pwa/outbox.ts)
 * from being double-applied. Each "duplicate" test asserts the collaborators are
 * never touched at all, not just that the return value looks right, since a bug
 * that ran the side effects anyway but still returned early would pass a looser
 * assertion.
 */
@ExtendWith(MockitoExtension.class)
class OutboxWriteServiceTest {

    @Mock FriendService friendService;
    @Mock AnalyticsService analyticsService;
    @Mock FriendKnowledgeService knowledgeService;
    @Mock ReviewService reviewService;
    @Mock ConsumedWriteRequestService ledger;

    private OutboxWriteService service() {
        return new OutboxWriteService(friendService, analyticsService, knowledgeService, reviewService, ledger);
    }

    // ── talkedToFriend ───────────────────────────────────────────────────────────

    @Test
    void applyTalkedToFriend_duplicateRequest_skipsEverythingAndReturnsInputUnchanged() {
        UUID requestId = UUID.randomUUID();
        when(ledger.isDuplicate(requestId)).thenReturn(true);
        Friend incoming = Friend.builder().build();

        Friend result = service().applyTalkedToFriend(1, incoming, requestId);

        assertThat(result).isSameAs(incoming);
        verifyNoInteractions(friendService, analyticsService, knowledgeService, reviewService);
        verify(ledger, never()).markConsumed(any(), any());
    }

    @Test
    void applyTalkedToFriend_newRequest_appliesAndMarksConsumed() {
        UUID requestId = UUID.randomUUID();
        when(ledger.isDuplicate(requestId)).thenReturn(false);
        Friend incoming = Friend.builder().build();
        Friend persisted = Friend.builder().build();
        when(friendService.updateFriend(1, incoming)).thenReturn(persisted);

        Friend result = service().applyTalkedToFriend(1, incoming, requestId);

        assertThat(result).isSameAs(persisted);
        verify(friendService).updateFriend(1, incoming);
        verify(analyticsService).saveAll(null, 1);
        verify(knowledgeService).saveAll(null, 1);
        verify(ledger).markConsumed(requestId, "talkedToFriend");
    }

    @Test
    void applyTalkedToFriend_nullRequestId_appliesWithoutTouchingLedger() {
        Friend incoming = Friend.builder().build();
        when(friendService.updateFriend(1, incoming)).thenReturn(incoming);

        service().applyTalkedToFriend(1, incoming, null);

        verify(ledger, never()).isDuplicate(any());
        verify(ledger, never()).markConsumed(any(), any());
        verify(friendService).updateFriend(1, incoming);
    }

    @Test
    void applyTalkedToFriend_withLoggedAnalytics_regradesViaReviewService() {
        UUID requestId = UUID.randomUUID();
        when(ledger.isDuplicate(requestId)).thenReturn(false);
        Analytics logged = Analytics.builder().hours(2.0).inPerson(true).build();
        Friend incoming = Friend.builder().analytics(List.of(logged)).build();
        Friend persisted = Friend.builder().experience("beginner").build();
        when(friendService.updateFriend(1, incoming)).thenReturn(persisted);
        LocalDate planned = LocalDate.of(2026, 9, 1);
        when(reviewService.reviewInteraction(persisted, 2.0, "beginner", true, LocalDate.now())).thenReturn(planned);

        service().applyTalkedToFriend(1, incoming, requestId);

        assertThat(persisted.getPlannedSpeakingTime()).isEqualTo(planned);
        verify(friendService).save(persisted);
    }

    // ── addFriend ────────────────────────────────────────────────────────────────

    @Test
    void applyAddFriend_duplicateRequest_skipsEverything() {
        UUID requestId = UUID.randomUUID();
        when(ledger.isDuplicate(requestId)).thenReturn(true);
        Friend incoming = Friend.builder().build();

        service().applyAddFriend(incoming, requestId);

        verifyNoInteractions(friendService, analyticsService, knowledgeService, reviewService);
        verify(ledger, never()).markConsumed(any(), any());
    }

    @Test
    void applyAddFriend_newRequest_appliesAndMarksConsumed() {
        UUID requestId = UUID.randomUUID();
        when(ledger.isDuplicate(requestId)).thenReturn(false);
        Analytics first = Analytics.builder().hours(1.5).inPerson(false).date(LocalDate.now()).build();
        Friend incoming = Friend.builder().experience("intermediate").analytics(List.of(first)).build();
        LocalDate planned = LocalDate.of(2026, 9, 5);
        when(reviewService.reviewInteraction(incoming, 1.5, "intermediate", false, first.getDate())).thenReturn(planned);

        service().applyAddFriend(incoming, requestId);

        assertThat(incoming.getPlannedSpeakingTime()).isEqualTo(planned);
        verify(friendService).save(incoming);
        verify(analyticsService).saveAll(incoming);
        verify(knowledgeService).saveAll(incoming.getKnowledge());
        verify(ledger).markConsumed(requestId, "addFriend");
    }

    // ── addKnowledge ─────────────────────────────────────────────────────────────

    @Test
    void applyAddKnowledge_duplicateRequest_skipsEverythingAndReturnsEmpty() {
        UUID requestId = UUID.randomUUID();
        when(ledger.isDuplicate(requestId)).thenReturn(true);

        List<Integer> result = service().applyAddKnowledge(1, List.of(new FriendKnowledge()), requestId);

        assertThat(result).isEmpty();
        verifyNoInteractions(friendService, knowledgeService);
        verify(ledger, never()).markConsumed(any(), any());
    }

    @Test
    void applyAddKnowledge_friendNotFound_throwsAndNeverMarksConsumed() {
        UUID requestId = UUID.randomUUID();
        when(ledger.isDuplicate(requestId)).thenReturn(false);
        when(friendService.getFriendById(99)).thenReturn(null);
        FriendKnowledge fact = new FriendKnowledge();
        fact.setText("x");

        assertThatThrownBy(() -> service().applyAddKnowledge(99, List.of(fact), requestId))
            .isInstanceOf(EntityNotFoundException.class);

        verify(ledger, never()).markConsumed(any(), any());
        verifyNoInteractions(knowledgeService);
    }

    @Test
    void applyAddKnowledge_newRequest_appliesAndMarksConsumed() {
        UUID requestId = UUID.randomUUID();
        when(ledger.isDuplicate(requestId)).thenReturn(false);
        Friend friend = Friend.builder().build();
        when(friendService.getFriendById(1)).thenReturn(friend);
        FriendKnowledge fact = new FriendKnowledge();
        fact.setText("likes chess");

        List<Integer> result = service().applyAddKnowledge(1, List.of(fact), requestId);

        // Id is null: the service always clears it before saving new facts (k.setId(null))
        // and saveAll is mocked here, so nothing assigns a real one back. Asserting the
        // dispatch shape (one result, matching the cleared id), not real persistence.
        assertThat(result).hasSize(1);
        assertThat(result.get(0)).isNull();
        verify(knowledgeService).saveAll(List.of(fact));
        verify(ledger).markConsumed(requestId, "addKnowledge");
    }

    @Test
    void applyAddKnowledge_blankText_throwsIllegalArgument() {
        UUID requestId = UUID.randomUUID();
        when(ledger.isDuplicate(requestId)).thenReturn(false);
        when(friendService.getFriendById(1)).thenReturn(Friend.builder().build());
        FriendKnowledge blank = new FriendKnowledge();
        blank.setText("  ");

        assertThatThrownBy(() -> service().applyAddKnowledge(1, List.of(blank), requestId))
            .isInstanceOf(IllegalArgumentException.class);
    }
}
