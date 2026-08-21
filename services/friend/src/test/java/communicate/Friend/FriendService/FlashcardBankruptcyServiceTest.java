package communicate.Friend.FriendService;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import communicate.Friend.FriendEntities.Friend;
import communicate.Friend.FriendEntities.FriendKnowledgeReview;
import communicate.Friend.FriendEntities.FriendKnowledgeReview.SourceType;
import communicate.Friend.FriendRepositories.FriendKnowledgeReviewRepository;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

/** Ported two-pass lapse job from OO's chrono/BankruptcyService.java — see FlashcardBankruptcyService class doc. */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class FlashcardBankruptcyServiceTest {

    @Mock FriendKnowledgeReviewRepository reviewRepository;

    FlashcardBankruptcyService service;
    final LocalDate today = LocalDate.now();

    @BeforeEach
    void setUp() {
        service = new FlashcardBankruptcyService(reviewRepository, new FsrsService());
    }

    private FriendKnowledgeReview row(int id, LocalDate due, Double stability, Double difficulty) {
        Friend friendRef = new Friend();
        friendRef.setId(1);
        return FriendKnowledgeReview.builder()
            .id(id).friend(friendRef).sourceType(SourceType.FRIEND).sourceKnowledgeId(id)
            .fsrsStability(stability).fsrsDifficulty(difficulty)
            .lastReviewedDate(stability != null ? due.minusDays(30) : null)
            .dueDate(due).build();
    }

    @Test
    void chronicOverdue_lapsedIndividually_belowBankruptcyThreshold() {
        // 10 days overdue > 7-day grace -> chronic. Only 1 overdue row total, well below any sane bankruptcyLimit.
        FriendKnowledgeReview chronic = row(1, today.minusDays(10), 10.0, 4.0);
        when(reviewRepository.findByFriend_FlashcardsEnabledTrue()).thenReturn(List.of(chronic));

        FlashcardBankruptcyService.BankruptcyResult result = service.run(200, 7);

        assertThat(result.overdueCount()).isEqualTo(1);
        assertThat(result.chronicNeglected()).isEqualTo(1);
        assertThat(result.declared()).isFalse();
        assertThat(result.rescheduled()).isEqualTo(0);
        // forget() collapses stability below its prior value (lapse signature).
        assertThat(chronic.getFsrsStability()).isLessThan(10.0);
        assertThat(chronic.getDueDate()).isAfter(today);
        assertThat(chronic.getLastReviewedDate()).isEqualTo(today); // anchor reset, no reward/penalty beyond the lapse
    }

    @Test
    void withinGracePeriod_notChronic_leftAloneUnlessBankruptcyDeclared() {
        FriendKnowledgeReview standard = row(1, today.minusDays(3), 10.0, 4.0); // 3 days overdue, within 7-day grace
        when(reviewRepository.findByFriend_FlashcardsEnabledTrue()).thenReturn(List.of(standard));

        FlashcardBankruptcyService.BankruptcyResult result = service.run(200, 7);

        assertThat(result.chronicNeglected()).isEqualTo(0);
        assertThat(result.declared()).isFalse();
        assertThat(standard.getFsrsStability()).isEqualTo(10.0); // untouched
    }

    @Test
    void totalOverdueMeetsThreshold_massBankruptcyLapsesEverythingRemaining() {
        List<FriendKnowledgeReview> rows = new ArrayList<>();
        FriendKnowledgeReview chronic = row(1, today.minusDays(10), 10.0, 4.0); // chronic
        rows.add(chronic);
        for (int i = 2; i <= 4; i++) {
            rows.add(row(i, today.minusDays(2), 10.0, 4.0)); // standard, within grace
        }
        when(reviewRepository.findByFriend_FlashcardsEnabledTrue()).thenReturn(rows);

        // 4 total overdue (1 chronic + 3 standard) meets a bankruptcyLimit of 4.
        FlashcardBankruptcyService.BankruptcyResult result = service.run(4, 7);

        assertThat(result.overdueCount()).isEqualTo(4);
        assertThat(result.chronicNeglected()).isEqualTo(1);
        assertThat(result.declared()).isTrue();
        assertThat(result.rescheduled()).isEqualTo(3);
        // Every row — chronic and mass-bankrupted standard alike — got lapsed;
        // no reward/penalty beyond the lapse itself (no bandit in this feature to begin with).
        assertThat(rows).allMatch(r -> r.getFsrsStability() < 10.0);
        assertThat(rows).allMatch(r -> r.getDueDate().isAfter(today));
    }

    @Test
    void neverReviewedRow_bootstrapsFromHardGradeBeforeLapsing() {
        FriendKnowledgeReview neverReviewed = row(1, today.minusDays(10), null, null);
        when(reviewRepository.findByFriend_FlashcardsEnabledTrue()).thenReturn(List.of(neverReviewed));

        service.run(200, 7);

        assertThat(neverReviewed.getFsrsStability()).isNotNull();
        assertThat(neverReviewed.getDueDate()).isAfter(today);
    }
}
