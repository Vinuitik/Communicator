package communicate.Friend.FriendService;

import java.time.LocalDate;
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

/** Ported day-cap mechanism from OO's chrono/SpreadService.java — see FlashcardSpreadService class doc. */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class FlashcardSpreadServiceTest {

    @Mock FriendKnowledgeReviewRepository reviewRepository;

    FlashcardSpreadService service;
    final LocalDate today = LocalDate.now();

    @BeforeEach
    void setUp() {
        service = new FlashcardSpreadService(reviewRepository);
    }

    private FriendKnowledgeReview row(int id, double difficulty, LocalDate due) {
        Friend friendRef = new Friend();
        friendRef.setId(1);
        return FriendKnowledgeReview.builder()
            .id(id).friend(friendRef).sourceType(SourceType.FRIEND).sourceKnowledgeId(id)
            .fsrsStability(5.0).fsrsDifficulty(difficulty).dueDate(due)
            .build();
    }

    @Test
    void overloadedDay_hardestStay_easiestSpillToNextDay() {
        // 5 rows due today, cap of 3 -> the 2 easiest (lowest difficulty) spill to today+1.
        List<FriendKnowledgeReview> rows = List.of(
            row(1, 9.0, today), // hardest -> stays
            row(2, 8.0, today), // stays
            row(3, 7.0, today), // stays
            row(4, 3.0, today), // easiest -> spills
            row(5, 2.0, today)  // easiest -> spills
        );
        when(reviewRepository.findByFriend_FlashcardsEnabledTrue()).thenReturn(rows);

        FlashcardSpreadService.SpreadResult result = service.run(3);

        assertThat(result.total()).isEqualTo(5);
        assertThat(result.moved()).isEqualTo(2);
        assertThat(rows.get(0).getDueDate()).isEqualTo(today); // difficulty 9
        assertThat(rows.get(1).getDueDate()).isEqualTo(today); // difficulty 8
        assertThat(rows.get(2).getDueDate()).isEqualTo(today); // difficulty 7
        assertThat(rows.get(3).getDueDate()).isEqualTo(today.plusDays(1)); // difficulty 3
        assertThat(rows.get(4).getDueDate()).isEqualTo(today.plusDays(1)); // difficulty 2
    }

    @Test
    void underCap_leftAlone() {
        List<FriendKnowledgeReview> rows = List.of(row(1, 5.0, today), row(2, 5.0, today));
        when(reviewRepository.findByFriend_FlashcardsEnabledTrue()).thenReturn(rows);

        FlashcardSpreadService.SpreadResult result = service.run(30);

        assertThat(result.moved()).isEqualTo(0);
        assertThat(rows).allMatch(r -> r.getDueDate().equals(today));
    }
}
