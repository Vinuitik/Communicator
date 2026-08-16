package communicate.Friend.FriendService;

import communicate.Friend.Config.RoleProperties;
import communicate.Friend.FriendEntities.Friend;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.time.LocalDate;

import static communicate.Friend.FriendService.FsrsService.GRADE_GOOD;
import static communicate.Friend.FriendService.FsrsService.GRADE_HARD;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.doubleThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * Glue-level tests: grade -> FSRS state update -> bandit arm -> due date,
 * plus the delayed reward/leech signal for the PREVIOUS decision. Uses a
 * real FsrsService (pinned math already covered by FsrsServiceTest) and
 * mocks for the collaborators so each test can control the grade/arm
 * directly, matching OO's ReviewServiceTest pattern.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class ReviewServiceTest {

    @Mock BanditService bandit;
    @Mock GradeComputationService gradeComputation;
    @Mock RoleProperties roleProperties;
    @Mock ExplanationService explanationService;
    @Mock LeechService leechService;

    ReviewService service;
    final LocalDate today = LocalDate.parse("2026-06-12");

    @BeforeEach
    void setUp() {
        FsrsService fsrs = new FsrsService();
        when(bandit.bucket(anyDouble(), anyDouble())).thenReturn("dEasy:sShort");
        when(bandit.chooseArm(anyString())).thenReturn(1.0);
        when(roleProperties.getDesiredRetention(any())).thenReturn(0.9);
        when(explanationService.explainTemplate(any(), any(), anyInt(), anyDouble(), any())).thenReturn("template");
        when(explanationService.explainViaLlm(anyString())).thenReturn("polished");
        service = new ReviewService(fsrs, bandit, gradeComputation, roleProperties, explanationService, leechService);
    }

    @Test
    void firstInteraction_createsInitialFsrsState_noRewardOrLeechYet() {
        when(gradeComputation.computeGrade(2.0, "***", true)).thenReturn(GRADE_GOOD);
        Friend friend = Friend.builder().build(); // no prior FSRS state

        LocalDate due = service.reviewInteraction(friend, 2.0, "***", true, today);

        assertThat(friend.getFsrsStability()).isCloseTo(2.3065, org.assertj.core.data.Offset.offset(1e-4));
        assertThat(due).isEqualTo(today.plusDays(2)); // baseInterval 2d x arm 1.0
        verify(bandit, never()).reward(anyString(), anyDouble(), anyBoolean());
        verifyNoInteractions(leechService);
        assertThat(friend.getSchedulingExplanation()).isEqualTo("polished");
    }

    @Test
    void onTimeInteraction_creditsIntendedArm_recordsHit() {
        // Prior decision: lastInteraction 3 days ago, due today, intended arm 1.2
        // -> scheduled span 3d, base = 3/1.2 = 2.5d, actual elapsed 3d -> effective 1.2
        Friend friend = Friend.builder()
            .fsrsStability(2.3065).fsrsDifficulty(2.118104)
            .lastInteractionDate(today.minusDays(3))
            .plannedSpeakingTime(today)
            .pendingBanditArm(1.2).pendingBanditBucket("dEasy:sShort")
            .build();
        when(gradeComputation.computeGrade(anyDouble(), any(), any())).thenReturn(GRADE_GOOD);

        service.reviewInteraction(friend, 1.0, "**", false, today);

        verify(bandit).reward(eq("dEasy:sShort"), doubleThat(d -> Math.abs(d - 1.2) < 1e-6), eq(true));
        verify(leechService).recordHit(friend);
        verify(leechService, never()).recordMiss(any());
    }

    @Test
    void hardGrade_countsAsNotRecalled_forBanditReward() {
        Friend friend = Friend.builder()
            .fsrsStability(2.3065).fsrsDifficulty(2.118104)
            .lastInteractionDate(today.minusDays(3))
            .plannedSpeakingTime(today)
            .pendingBanditArm(1.0).pendingBanditBucket("dEasy:sShort")
            .build();
        when(gradeComputation.computeGrade(anyDouble(), any(), any())).thenReturn(GRADE_HARD);

        service.reviewInteraction(friend, 0.2, "*", false, today);

        verify(bandit).reward(eq("dEasy:sShort"), anyDouble(), eq(false));
    }

    @Test
    void lateInteraction_afterPlannedDate_recordsMiss_notHit() {
        // Predicted due date was 5 days ago; friend finally reaches out today.
        Friend friend = Friend.builder()
            .fsrsStability(2.3065).fsrsDifficulty(2.118104)
            .lastInteractionDate(today.minusDays(10))
            .plannedSpeakingTime(today.minusDays(5))
            .pendingBanditArm(1.0).pendingBanditBucket("dEasy:sShort")
            .build();
        when(gradeComputation.computeGrade(anyDouble(), any(), any())).thenReturn(GRADE_GOOD);

        service.reviewInteraction(friend, 1.0, "**", false, today);

        verify(leechService).recordMiss(friend);
        verify(leechService, never()).recordHit(any());
    }

    @Test
    void banditArmScalesTheScheduledDate_butNotTheStoredState() {
        when(gradeComputation.computeGrade(anyDouble(), any(), any())).thenReturn(FsrsService.GRADE_EASY);
        when(bandit.chooseArm(anyString())).thenReturn(1.5);
        Friend friend = Friend.builder().build();

        LocalDate due = service.reviewInteraction(friend, 3.0, "***", true, today);

        // Base FSRS interval for first Easy is 8 days; the arm stretches the
        // due date to 12 days but stability stays pure FSRS (8.2956).
        assertThat(due).isEqualTo(today.plusDays(12));
        assertThat(friend.getFsrsStability()).isCloseTo(8.2956, org.assertj.core.data.Offset.offset(1e-4));
        assertThat(friend.getPendingBanditArm()).isEqualTo(1.5);
    }

    @Test
    void noPriorPlannedSpeakingTime_skipsRewardEvenWithFsrsState() {
        // Cold-start-backfilled friend: has FSRS state (from legacy history)
        // but no plannedSpeakingTime/pendingBanditArm yet -- nothing to reward against.
        Friend friend = Friend.builder()
            .fsrsStability(10.0).fsrsDifficulty(5.0)
            .lastInteractionDate(today.minusDays(20))
            .build();
        when(gradeComputation.computeGrade(anyDouble(), any(), any())).thenReturn(GRADE_GOOD);

        service.reviewInteraction(friend, 1.0, "**", false, today);

        verify(bandit, never()).reward(anyString(), anyDouble(), anyBoolean());
        verifyNoInteractions(leechService);
    }
}
