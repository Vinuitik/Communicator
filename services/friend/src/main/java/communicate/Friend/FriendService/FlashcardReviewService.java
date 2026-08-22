package communicate.Friend.FriendService;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.example.demo.Group.GroupEntities.GroupKnowledge;
import com.example.demo.Group.GroupRepositories.GroupKnowledgeRepository;

import communicate.Friend.DTOs.FlashcardCardDTO;
import communicate.Friend.DTOs.FlashcardFolderDTO;
import communicate.Friend.FriendEntities.Friend;
import communicate.Friend.FriendEntities.FriendKnowledge;
import communicate.Friend.FriendEntities.FriendKnowledgeReview;
import communicate.Friend.FriendEntities.FriendKnowledgeReview.SourceType;
import communicate.Friend.FriendRepositories.FriendKnowledgeRepository;
import communicate.Friend.FriendRepositories.FriendKnowledgeReviewRepository;
import communicate.Friend.FriendRepositories.FriendRepository;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;

/**
 * Quiz/reveal/grade flow for the flashcard-review feature, plus the
 * queue/folder reads the review page needs. Grading reuses FsrsService
 * exactly like ReviewService does for contact scheduling, but against
 * FriendKnowledgeReview's own independent stability/difficulty — see that
 * entity's javadoc for why the two states are kept separate.
 */
@Service
@RequiredArgsConstructor
public class FlashcardReviewService {

    private final FriendKnowledgeReviewRepository reviewRepository;
    private final FriendRepository friendRepository;
    private final FriendKnowledgeRepository friendKnowledgeRepository;
    private final GroupKnowledgeRepository groupKnowledgeRepository;
    private final FsrsService fsrs;

    /** Today's capped/spread queue across every starred friend (FlashcardSpreadService already enforces the daily cap by writing dueDate forward). */
    @Transactional
    public List<FlashcardCardDTO> getTodayQueue() {
        List<FriendKnowledgeReview> due = reviewRepository.findByFriend_FlashcardsEnabledTrueAndDueDateLessThanEqual(LocalDate.now());
        return toDtos(due);
    }

    /** One friend's whole deck, due or not — browsing a folder directly bypasses the daily cap (design doc, like Anki's Browse). */
    @Transactional
    public List<FlashcardCardDTO> getFolder(Integer friendId) {
        List<FriendKnowledgeReview> rows = reviewRepository.findByFriendIdOrderByDueDateAsc(friendId);
        return toDtos(rows);
    }

    /** Every starred friend, with due/total counts — the review page's folder list + empty-state driver. */
    @Transactional
    public List<FlashcardFolderDTO> getFolders() {
        LocalDate today = LocalDate.now();
        return friendRepository.findByFlashcardsEnabledTrueAndDeletedAtIsNull().stream()
            .map(f -> {
                List<FriendKnowledgeReview> rows = reviewRepository.findByFriendId(f.getId());
                long due = rows.stream().filter(r -> !r.getDueDate().isAfter(today)).count();
                return new FlashcardFolderDTO(f.getId(), f.getName(), due, rows.size());
            })
            .toList();
    }

    /**
     * Self-graded Hard/Good/Easy (FsrsService.GRADE_HARD/GOOD/EASY) — first
     * review on this card seeds state via initialState(grade), same
     * first-review branch ReviewService uses for Friend's own FSRS state.
     */
    @Transactional
    public FlashcardCardDTO gradeCard(Integer reviewId, int grade) {
        FriendKnowledgeReview row = reviewRepository.findById(reviewId)
            .orElseThrow(() -> new EntityNotFoundException("Review row " + reviewId + " not found."));

        LocalDate today = LocalDate.now();
        FsrsService.FsrsState state;
        if (row.getFsrsStability() == null || row.getFsrsDifficulty() == null) {
            state = fsrs.initialState(grade);
        } else {
            double elapsedDays = row.getLastReviewedDate() == null
                ? 0
                : Math.max(0, ChronoUnit.DAYS.between(row.getLastReviewedDate(), today));
            state = fsrs.review(new FsrsService.FsrsState(row.getFsrsStability(), row.getFsrsDifficulty()), grade, elapsedDays);
        }

        int intervalDays = fsrs.intervalDays(state.stability(), FlashcardEnrollmentService.DESIRED_RETENTION);

        row.setFsrsStability(state.stability());
        row.setFsrsDifficulty(state.difficulty());
        row.setLastReviewedDate(today);
        row.setDueDate(today.plusDays(intervalDays));
        reviewRepository.save(row);

        return toDto(row);
    }

    private List<FlashcardCardDTO> toDtos(List<FriendKnowledgeReview> rows) {
        if (rows.isEmpty()) return List.of();

        Map<Integer, Friend> friendsById = friendRepository.findAllById(
                rows.stream().map(r -> r.getFriend().getId()).distinct().toList())
            .stream().collect(Collectors.toMap(Friend::getId, f -> f));

        Map<Integer, FriendKnowledge> friendKnowledgeById = friendKnowledgeRepository.findAllById(
                rows.stream().filter(r -> r.getSourceType() == SourceType.FRIEND).map(FriendKnowledgeReview::getSourceKnowledgeId).distinct().toList())
            .stream().collect(Collectors.toMap(FriendKnowledge::getId, k -> k));

        Map<Integer, GroupKnowledge> groupKnowledgeById = groupKnowledgeRepository.findAllById(
                rows.stream().filter(r -> r.getSourceType() == SourceType.GROUP).map(FriendKnowledgeReview::getSourceKnowledgeId).distinct().toList())
            .stream().collect(Collectors.toMap(GroupKnowledge::getId, k -> k));

        return rows.stream().map(row -> {
            Friend friend = friendsById.get(row.getFriend().getId());
            String fact;
            Long importance;
            if (row.getSourceType() == SourceType.FRIEND) {
                FriendKnowledge k = friendKnowledgeById.get(row.getSourceKnowledgeId());
                fact = k != null ? k.getText() : "(deleted fact)";
                importance = k != null ? k.getPriority() : null;
            } else {
                GroupKnowledge k = groupKnowledgeById.get(row.getSourceKnowledgeId());
                fact = k != null ? k.getText() : "(deleted fact)";
                importance = k != null ? k.getPriority() : null;
            }
            return new FlashcardCardDTO(
                row.getId(),
                row.getFriend().getId(),
                friend != null ? friend.getName() : null,
                row.getSourceType().name(),
                row.getSourceKnowledgeId(),
                fact,
                importance,
                row.getFsrsStability(),
                row.getFsrsDifficulty(),
                row.getLastReviewedDate(),
                row.getDueDate()
            );
        }).toList();
    }

    private FlashcardCardDTO toDto(FriendKnowledgeReview row) {
        return toDtos(List.of(row)).get(0);
    }
}
