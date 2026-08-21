package communicate.Friend.FriendService;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.example.demo.Group.GroupEntities.GroupKnowledge;
import com.example.demo.Group.GroupRepositories.GroupKnowledgeRepository;

import communicate.Friend.FriendEntities.Friend;
import communicate.Friend.FriendEntities.FriendKnowledge;
import communicate.Friend.FriendEntities.FriendKnowledgeReview;
import communicate.Friend.FriendEntities.FriendKnowledgeReview.SourceType;
import communicate.Friend.FriendRepositories.FriendKnowledgeRepository;
import communicate.Friend.FriendRepositories.FriendKnowledgeReviewRepository;
import communicate.Friend.FriendRepositories.FriendRepository;
import communicate.Friend.FriendRepositories.GroupMemberRepository;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Star-toggle + enrollment for the flashcard-review feature (design doc
 * "Feature D"). A starred friend's reviewable deck = their own
 * FriendKnowledge rows UNION GroupKnowledge rows for every group they
 * belong to (join via GroupMemberRepository — group facts are pulled
 * through group's own repository, not a cross-module JPA join: friend now
 * depends on group at the Maven level (see friend/pom.xml) since both share
 * one datasource in this monolith, same "same JVM, plain bean call" pattern
 * chrono already uses for its own friend-module dependency).
 *
 * Known gap (documented, not fixed here — see task report): a NEW
 * GroupKnowledge fact added to a group after a member is already starred
 * does not auto-enroll into that member's folder, only personal
 * FriendKnowledge does (hooked in OutboxWriteService.applyAddKnowledge).
 * Hooking group-side creation would require group depending back on friend,
 * which would create a module cycle given friend already depends on group
 * for enrollment reads. It re-syncs on the next re-star (enrollFriend runs
 * again) or could be added later via a scheduled reconciliation pass.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class FlashcardEnrollmentService {

    /**
     * Fixed retention target for fact recall — deliberately NOT
     * RoleProperties.getDesiredRetention(friend.getRole()): that value tunes
     * how often you WANT TO CONTACT someone (a relationship-rhythm knob),
     * a different axis from how reliably you want to remember a fact about
     * them. Matches FsrsService's/py-fsrs's own global default.
     */
    static final double DESIRED_RETENTION = 0.9;

    private final FriendRepository friendRepository;
    private final FriendKnowledgeRepository friendKnowledgeRepository;
    private final GroupMemberRepository groupMemberRepository;
    private final GroupKnowledgeRepository groupKnowledgeRepository;
    private final FriendKnowledgeReviewRepository reviewRepository;
    private final FsrsService fsrs;

    /**
     * Enroll every current personal + inherited-group fact that doesn't
     * already have a review row for this friend. Safe to call repeatedly
     * (idempotent — skips anything already enrolled), so it's reused both
     * for the initial star and for picking up facts added while un-starred.
     */
    @Transactional
    public int enrollFriend(Integer friendId) {
        int enrolled = 0;
        List<FriendKnowledgeReview> toSave = new ArrayList<>();
        LocalDate today = LocalDate.now();

        for (FriendKnowledge k : friendKnowledgeRepository.findByFriendId(friendId)) {
            if (k.getId() == null) continue;
            if (reviewRepository.existsByFriendIdAndSourceTypeAndSourceKnowledgeId(friendId, SourceType.FRIEND, k.getId())) continue;
            toSave.add(newReviewRow(friendId, SourceType.FRIEND, k.getId(), today));
        }

        for (Integer groupId : groupMemberRepository.findGroupIdsByFriendId(friendId)) {
            for (GroupKnowledge k : groupKnowledgeRepository.findByGroupIdOrderByDateDesc(groupId)) {
                if (k.getId() == null) continue;
                if (reviewRepository.existsByFriendIdAndSourceTypeAndSourceKnowledgeId(friendId, SourceType.GROUP, k.getId())) continue;
                toSave.add(newReviewRow(friendId, SourceType.GROUP, k.getId(), today));
            }
        }

        if (!toSave.isEmpty()) {
            reviewRepository.saveAll(toSave);
            enrolled = toSave.size();
            log.info("[flashcards] Enrolled {} new review row(s) for friend {}", enrolled, friendId);
        }
        return enrolled;
    }

    /** Hook for FlashcardReviewController's star toggle — see class javadoc for the enroll/re-star contract. */
    @Transactional
    public Friend setFlashcardsEnabled(Integer friendId, boolean enabled) {
        Friend friend = friendRepository.findById(friendId)
            .orElseThrow(() -> new EntityNotFoundException("Friend with ID " + friendId + " not found."));

        boolean wasEnabled = Boolean.TRUE.equals(friend.getFlashcardsEnabled());

        if (enabled && !wasEnabled) {
            // Re-star (rows already exist from a prior star) vs. first-time
            // star (nothing to lapse yet) — only the former needs forget().
            List<FriendKnowledgeReview> existing = reviewRepository.findByFriendId(friendId);
            if (!existing.isEmpty()) {
                relapseOnRestar(existing);
            }
            friend.setFlashcardsEnabled(true);
            friendRepository.save(friend);
            enrollFriend(friendId);
        } else if (!enabled) {
            // Un-star hides rows from the review queue (query-filtered on
            // Friend.flashcardsEnabled) — never deletes them.
            friend.setFlashcardsEnabled(false);
            friendRepository.save(friend);
        }
        return friend;
    }

    /**
     * Re-star lapse: the off period counts as a lapse, same mechanism as
     * FsrsNeglectService's chronic-neglect pass — FsrsService.forget() on
     * every row that's actually been reviewed before (a never-reviewed row
     * has no FSRS state to lapse; it stays as-is, still immediately due).
     */
    private void relapseOnRestar(List<FriendKnowledgeReview> rows) {
        LocalDate today = LocalDate.now();
        List<FriendKnowledgeReview> toSave = new ArrayList<>();
        for (FriendKnowledgeReview row : rows) {
            if (row.getFsrsStability() == null || row.getFsrsDifficulty() == null) continue;
            LocalDate anchor = row.getLastReviewedDate() != null ? row.getLastReviewedDate() : row.getDueDate();
            double elapsedDays = Math.max(0, ChronoUnit.DAYS.between(anchor, today));

            FsrsService.FsrsState lapsed = fsrs.forget(
                new FsrsService.FsrsState(row.getFsrsStability(), row.getFsrsDifficulty()), elapsedDays);
            int newIntervalDays = fsrs.intervalDays(lapsed.stability(), DESIRED_RETENTION);

            row.setFsrsStability(lapsed.stability());
            row.setFsrsDifficulty(lapsed.difficulty());
            // Same anchor reset as FlashcardBankruptcyService's lapse path —
            // see its comment for why.
            row.setLastReviewedDate(today);
            row.setDueDate(today.plusDays(newIntervalDays));
            toSave.add(row);
        }
        if (!toSave.isEmpty()) {
            reviewRepository.saveAll(toSave);
        }
    }

    private static FriendKnowledgeReview newReviewRow(Integer friendId, SourceType type, Integer sourceId, LocalDate today) {
        Friend friendRef = new Friend();
        friendRef.setId(friendId);
        return FriendKnowledgeReview.builder()
            .friend(friendRef)
            .sourceType(type)
            .sourceKnowledgeId(sourceId)
            .dueDate(today)
            .build();
    }
}
