package communicate.Friend.FriendService;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import com.example.demo.Group.GroupRepositories.GroupKnowledgeRepository;

import communicate.Friend.DTOs.FlashcardCardDTO;
import communicate.Friend.FriendEntities.Friend;
import communicate.Friend.FriendEntities.FriendKnowledge;
import communicate.Friend.FriendEntities.FriendKnowledgeReview;
import communicate.Friend.FriendEntities.FriendKnowledgeReview.SourceType;
import communicate.Friend.FriendRepositories.FriendKnowledgeRepository;
import communicate.Friend.FriendRepositories.FriendKnowledgeReviewRepository;
import communicate.Friend.FriendRepositories.FriendRepository;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class FlashcardReviewServiceTest {

    @Mock FriendKnowledgeReviewRepository reviewRepository;
    @Mock FriendRepository friendRepository;
    @Mock FriendKnowledgeRepository friendKnowledgeRepository;
    @Mock GroupKnowledgeRepository groupKnowledgeRepository;

    FlashcardReviewService service;
    final LocalDate today = LocalDate.now();

    @BeforeEach
    void setUp() {
        service = new FlashcardReviewService(reviewRepository, friendRepository, friendKnowledgeRepository, groupKnowledgeRepository, new FsrsService());
    }

    @Test
    void firstGrade_seedsInitialState_notReviewPath() {
        Friend friend = Friend.builder().id(1).name("Alex").build();
        Friend friendRef = new Friend();
        friendRef.setId(1);
        FriendKnowledgeReview row = FriendKnowledgeReview.builder()
            .id(7).friend(friendRef).sourceType(SourceType.FRIEND).sourceKnowledgeId(10).dueDate(today).build();
        when(reviewRepository.findById(7)).thenReturn(Optional.of(row));
        when(friendRepository.findAllById(List.of(1))).thenReturn(List.of(friend));
        FriendKnowledge k = new FriendKnowledge();
        k.setId(10); k.setText("likes coffee"); k.setPriority(5L);
        when(friendKnowledgeRepository.findAllById(List.of(10))).thenReturn(List.of(k));

        FlashcardCardDTO dto = service.gradeCard(7, FsrsService.GRADE_GOOD);

        assertThat(dto.fact()).isEqualTo("likes coffee");
        assertThat(dto.friendName()).isEqualTo("Alex");
        assertThat(row.getFsrsStability()).isNotNull();
        assertThat(row.getLastReviewedDate()).isEqualTo(today);
        assertThat(row.getDueDate()).isAfter(today);
    }

    @Test
    void secondGrade_usesReviewPath_notReset() {
        Friend friendRef = new Friend();
        friendRef.setId(1);
        FriendKnowledgeReview row = FriendKnowledgeReview.builder()
            .id(7).friend(friendRef).sourceType(SourceType.FRIEND).sourceKnowledgeId(10)
            .fsrsStability(5.0).fsrsDifficulty(4.0).lastReviewedDate(today.minusDays(5)).dueDate(today).build();
        when(reviewRepository.findById(7)).thenReturn(Optional.of(row));
        when(friendRepository.findAllById(List.of(1))).thenReturn(List.of());
        when(friendKnowledgeRepository.findAllById(List.of(10))).thenReturn(List.of());

        service.gradeCard(7, FsrsService.GRADE_EASY);

        // Easy grade on an existing card should grow stability, not reset it
        // to the small first-review seed value.
        assertThat(row.getFsrsStability()).isGreaterThan(5.0);
    }
}
