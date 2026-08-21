package communicate.Friend.FriendService;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

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

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class FlashcardEnrollmentServiceTest {

    @Mock FriendRepository friendRepository;
    @Mock FriendKnowledgeRepository friendKnowledgeRepository;
    @Mock GroupMemberRepository groupMemberRepository;
    @Mock GroupKnowledgeRepository groupKnowledgeRepository;
    @Mock FriendKnowledgeReviewRepository reviewRepository;

    FlashcardEnrollmentService service;
    final LocalDate today = LocalDate.now();

    @BeforeEach
    void setUp() {
        FsrsService fsrs = new FsrsService();
        service = new FlashcardEnrollmentService(
            friendRepository, friendKnowledgeRepository, groupMemberRepository, groupKnowledgeRepository, reviewRepository, fsrs);
    }

    private static FriendKnowledge fact(int id) {
        FriendKnowledge k = new FriendKnowledge();
        k.setId(id);
        k.setText("fact " + id);
        k.setPriority(5L);
        return k;
    }

    private static GroupKnowledge groupFact(int id) {
        GroupKnowledge k = new GroupKnowledge();
        k.setId(id);
        k.setText("group fact " + id);
        k.setPriority(5L);
        return k;
    }

    @Test
    void enrollFriend_countsPersonalPlusInheritedGroupFacts_exactMatch() {
        int friendId = 1;
        when(friendKnowledgeRepository.findByFriendId(friendId)).thenReturn(List.of(fact(10), fact(11)));
        when(groupMemberRepository.findGroupIdsByFriendId(friendId)).thenReturn(List.of(100, 200));
        when(groupKnowledgeRepository.findByGroupIdOrderByDateDesc(100)).thenReturn(List.of(groupFact(500)));
        when(groupKnowledgeRepository.findByGroupIdOrderByDateDesc(200)).thenReturn(List.of(groupFact(501), groupFact(502)));
        when(reviewRepository.existsByFriendIdAndSourceTypeAndSourceKnowledgeId(eq(friendId), any(), anyInt())).thenReturn(false);

        int enrolled = service.enrollFriend(friendId);

        // 2 personal + 3 inherited-group facts = 5 total.
        assertThat(enrolled).isEqualTo(5);
        ArgumentCaptor<List<FriendKnowledgeReview>> captor = ArgumentCaptor.forClass(List.class);
        verify(reviewRepository).saveAll(captor.capture());
        assertThat(captor.getValue()).hasSize(5);
        assertThat(captor.getValue()).allMatch(r -> r.getDueDate().equals(today)); // freshly enrolled -> immediately due
        assertThat(captor.getValue()).filteredOn(r -> r.getSourceType() == SourceType.FRIEND).hasSize(2);
        assertThat(captor.getValue()).filteredOn(r -> r.getSourceType() == SourceType.GROUP).hasSize(3);
    }

    @Test
    void enrollFriend_skipsFactsAlreadyEnrolled() {
        int friendId = 1;
        when(friendKnowledgeRepository.findByFriendId(friendId)).thenReturn(List.of(fact(10), fact(11)));
        when(groupMemberRepository.findGroupIdsByFriendId(friendId)).thenReturn(List.of());
        when(reviewRepository.existsByFriendIdAndSourceTypeAndSourceKnowledgeId(friendId, SourceType.FRIEND, 10)).thenReturn(true);
        when(reviewRepository.existsByFriendIdAndSourceTypeAndSourceKnowledgeId(friendId, SourceType.FRIEND, 11)).thenReturn(false);

        int enrolled = service.enrollFriend(friendId);

        assertThat(enrolled).isEqualTo(1);
    }

    @Test
    void setFlashcardsEnabled_firstStar_noExistingRows_noLapseApplied() {
        int friendId = 1;
        Friend friend = Friend.builder().id(friendId).flashcardsEnabled(false).build();
        when(friendRepository.findById(friendId)).thenReturn(Optional.of(friend));
        when(reviewRepository.findByFriendId(friendId)).thenReturn(List.of());
        when(friendKnowledgeRepository.findByFriendId(friendId)).thenReturn(List.of());
        when(groupMemberRepository.findGroupIdsByFriendId(friendId)).thenReturn(List.of());

        Friend result = service.setFlashcardsEnabled(friendId, true);

        assertThat(result.getFlashcardsEnabled()).isTrue();
        // Nothing to lapse — findByFriendId returned empty, so no forget()
        // path runs and saveAll is never called from the relapse branch.
        verify(reviewRepository, never()).saveAll(any());
    }

    @Test
    void setFlashcardsEnabled_reStar_lapsesReviewedRows_leavesNeverReviewedRowsAlone() {
        int friendId = 1;
        Friend friend = Friend.builder().id(friendId).flashcardsEnabled(false).build();
        when(friendRepository.findById(friendId)).thenReturn(Optional.of(friend));

        FriendKnowledgeReview reviewed = FriendKnowledgeReview.builder()
            .id(1).friend(friend).sourceType(SourceType.FRIEND).sourceKnowledgeId(10)
            .fsrsStability(10.0).fsrsDifficulty(4.0)
            .lastReviewedDate(today.minusDays(30))
            .dueDate(today.minusDays(20))
            .build();
        FriendKnowledgeReview neverReviewed = FriendKnowledgeReview.builder()
            .id(2).friend(friend).sourceType(SourceType.FRIEND).sourceKnowledgeId(11)
            .dueDate(today.minusDays(5))
            .build();
        when(reviewRepository.findByFriendId(friendId)).thenReturn(List.of(reviewed, neverReviewed));
        when(friendKnowledgeRepository.findByFriendId(friendId)).thenReturn(List.of());
        when(groupMemberRepository.findGroupIdsByFriendId(friendId)).thenReturn(List.of());

        service.setFlashcardsEnabled(friendId, true);

        // forget() collapses stability below its prior value (lapse signature).
        assertThat(reviewed.getFsrsStability()).isLessThan(10.0);
        assertThat(reviewed.getDueDate()).isAfter(today.minusDays(1)); // rescheduled into the future
        assertThat(reviewed.getLastReviewedDate()).isEqualTo(today);
        // Never-reviewed row has no FSRS state to lapse -- left untouched.
        assertThat(neverReviewed.getFsrsStability()).isNull();
        assertThat(neverReviewed.getDueDate()).isEqualTo(today.minusDays(5));
    }

    @Test
    void setFlashcardsEnabled_off_hidesRows_neverTouchesReviewRepository() {
        int friendId = 1;
        Friend friend = Friend.builder().id(friendId).flashcardsEnabled(true).build();
        when(friendRepository.findById(friendId)).thenReturn(Optional.of(friend));

        Friend result = service.setFlashcardsEnabled(friendId, false);

        assertThat(result.getFlashcardsEnabled()).isFalse();
        // Un-star hides via the flashcardsEnabled query filter -- rows are
        // never deleted or otherwise mutated.
        verifyNoInteractions(reviewRepository);
    }
}
