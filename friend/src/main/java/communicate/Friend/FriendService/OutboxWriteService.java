package communicate.Friend.FriendService;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;

import com.communicator.outboxcore.service.ConsumedWriteRequestService;

import communicate.Friend.FriendEntities.Analytics;
import communicate.Friend.FriendEntities.Friend;
import communicate.Friend.FriendEntities.FriendKnowledge;
import jakarta.persistence.EntityNotFoundException;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;

/**
 * Single place that actually applies each offline-outbox write kind — shared by the HTTP
 * controllers (FriendController, FriendKnowledgeController) and the Drive-mailbox consume
 * job (MailboxConsumeService), so the idempotency ledger check/write and the underlying side
 * effects (analytics/knowledge appends, FSRS scheduling) only exist in one place. Extracted
 * from what was previously inline controller logic — behavior is unchanged for existing HTTP
 * callers, this just gives the mailbox consumer the same call path instead of re-deriving it.
 */
@Service
@RequiredArgsConstructor
public class OutboxWriteService {

    private final FriendService friendService;
    private final AnalyticsService analyticsService;
    private final FriendKnowledgeService knowledgeService;
    private final ReviewService reviewService;
    private final ConsumedWriteRequestService ledger;
    private final ApplicationEventPublisher eventPublisher;
    private final FlashcardEnrollmentService flashcardEnrollmentService;

    @Transactional
    public Friend applyTalkedToFriend(Integer id, Friend friend, UUID requestId) {
        if (requestId != null && ledger.isDuplicate(requestId)) {
            return friend;
        }

        List<Analytics> analytics = friend.getAnalytics();
        List<FriendKnowledge> knowledges = friend.getKnowledge();

        friend = friendService.updateFriend(id, friend);

        // FSRS-interval x bandit-arm replaces the fixed star-rating ladder (design doc Next
        // Steps #6), graded on the newly logged interaction. reviewInteraction needs the
        // friend's PERSISTED scheduling state, which is why this runs on the entity
        // updateFriend() just merged and returned, not the sparse incoming request body. No
        // analytics logged this call -> nothing to grade, leave the existing due date as-is.
        if (analytics != null && !analytics.isEmpty()) {
            Analytics logged = analytics.get(0);
            LocalDate plannedTime = reviewService.reviewInteraction(friend,
                logged.getHours() != null ? logged.getHours() : 0.0,
                friend.getExperience(), logged.getInPerson(), LocalDate.now());
            friend.setPlannedSpeakingTime(plannedTime);
            friendService.save(friend);
            // TODO(Feature B, read-side stage): plannedSpeakingTime stays as a dual-write
            // for now so existing readers don't break; retire once every reader moves to
            // querying Meeting instead.
            eventPublisher.publishEvent(new FriendRescheduledEvent(friend.getId(), plannedTime));
        }

        analyticsService.saveAll(analytics, id);
        knowledgeService.saveAll(knowledges, id);

        if (requestId != null) {
            ledger.markConsumed(requestId, "talkedToFriend");
        }
        return friend;
    }

    @Transactional
    public void applyAddFriend(Friend friend, UUID requestId) {
        if (requestId != null && ledger.isDuplicate(requestId)) {
            return;
        }

        // FSRS-interval x bandit-arm replaces the fixed star-rating ladder (design doc Next
        // Steps #6) — graded on the friend's first logged interaction, same as ReviewService's
        // "existing == null" first-review case.
        Analytics firstAnalytics = friend.getAnalytics().get(0);
        LocalDate plannedTime = reviewService.reviewInteraction(friend,
            firstAnalytics.getHours() != null ? firstAnalytics.getHours() : 0.0,
            friend.getExperience(), firstAnalytics.getInPerson(), firstAnalytics.getDate());
        friend.setPlannedSpeakingTime(plannedTime);

        friendService.save(friend);
        analyticsService.saveAll(friend);
        knowledgeService.saveAll(friend.getKnowledge());
        eventPublisher.publishEvent(new FriendRescheduledEvent(friend.getId(), plannedTime));

        if (requestId != null) {
            ledger.markConsumed(requestId, "addFriend");
        }
    }

    /** Throws EntityNotFoundException if friendId doesn't exist — the controller translates
     * that to a 404, the mailbox consume job leaves the file for the next pass. */
    @Transactional
    public List<Integer> applyAddKnowledge(Integer friendId, List<FriendKnowledge> knowledge, UUID requestId) {
        if (requestId != null && ledger.isDuplicate(requestId)) {
            return List.of();
        }

        Friend friend = friendService.getFriendById(friendId);
        if (friend == null) {
            throw new EntityNotFoundException("Friend with ID " + friendId + " not found.");
        }

        for (FriendKnowledge k : knowledge) {
            k.setFriend(friend);
            k.setId(null); // Ensure ID is null for new entities
            if (k.getDate() == null) {
                k.setDate(LocalDate.now());
            }
            if (k.getPriority() == null) {
                k.setPriority(5L); // Default priority
            }
            if (k.getText() == null || k.getText().trim().isEmpty()) {
                throw new IllegalArgumentException("Knowledge text cannot be null or empty");
            }
        }

        knowledgeService.saveAll(knowledge);
        List<Integer> ids = knowledge.stream().map(FriendKnowledge::getId).toList();

        // New knowledge logged for an already-starred friend auto-enrolls as
        // a flashcard too (design doc "Feature D") — gated on
        // Friend.flashcardsEnabled, same friend object already loaded above.
        if (Boolean.TRUE.equals(friend.getFlashcardsEnabled())) {
            flashcardEnrollmentService.enrollFriend(friendId);
        }

        if (requestId != null) {
            ledger.markConsumed(requestId, "addKnowledge");
        }
        return ids;
    }
}
