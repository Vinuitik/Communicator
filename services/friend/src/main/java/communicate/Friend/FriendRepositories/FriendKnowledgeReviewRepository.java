package communicate.Friend.FriendRepositories;

import java.time.LocalDate;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import communicate.Friend.FriendEntities.FriendKnowledgeReview;
import communicate.Friend.FriendEntities.FriendKnowledgeReview.SourceType;

@Repository
public interface FriendKnowledgeReviewRepository extends JpaRepository<FriendKnowledgeReview, Integer> {

    // Folder browsing (Friend.java's flashcardsEnabled star) — every card for
    // one friend regardless of due date, not subject to the daily cap.
    List<FriendKnowledgeReview> findByFriendIdOrderByDueDateAsc(Integer friendId);

    List<FriendKnowledgeReview> findByFriendId(Integer friendId);

    boolean existsByFriendIdAndSourceTypeAndSourceKnowledgeId(Integer friendId, SourceType sourceType, Integer sourceKnowledgeId);

    // Today's capped/spread queue — only rows belonging to a currently
    // starred friend, due today or earlier. Spread/bankruptcy jobs already
    // wrote dueDate forward for anything over the cap, so no extra
    // in-request capping is needed here.
    List<FriendKnowledgeReview> findByFriend_FlashcardsEnabledTrueAndDueDateLessThanEqual(LocalDate date);

    // Whole pool across every starred friend — input to the nightly
    // spread/bankruptcy jobs (FlashcardSpreadService/FlashcardBankruptcyService).
    List<FriendKnowledgeReview> findByFriend_FlashcardsEnabledTrue();
}
