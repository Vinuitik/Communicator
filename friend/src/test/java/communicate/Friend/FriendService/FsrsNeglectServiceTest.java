package communicate.Friend.FriendService;

import communicate.Friend.Config.RoleProperties;
import communicate.Friend.FriendEntities.Friend;
import communicate.Friend.FriendRepositories.FriendRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Ported from OO's BankruptcyService test intent, minus the mass-bankruptcy
 * threshold pass (dropped — see FsrsNeglectService class doc). Covers: which
 * friends get lapsed, that pendingBanditArm/Bucket survive untouched (no
 * bandit reward for an exogenous lapse), and least-loaded-day spreading.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class FsrsNeglectServiceTest {

    @Mock FriendRepository friendRepository;
    @Mock RoleProperties roleProperties;
    @Mock LeechService leechService;

    FsrsNeglectService service;
    // FsrsNeglectService calls LocalDate.now() internally (not clock-injectable),
    // so tests must anchor to the real clock too, not a fixed literal date.
    final LocalDate today = LocalDate.now();

    @BeforeEach
    void setUp() {
        FsrsService fsrs = new FsrsService();
        when(roleProperties.getDesiredRetention(any())).thenReturn(0.9);
        service = new FsrsNeglectService(friendRepository, fsrs, roleProperties, leechService);
    }

    @Test
    void notYetOverdue_isLeftAlone() {
        Friend friend = Friend.builder().id(1).fsrsStability(5.0).fsrsDifficulty(3.0)
            .plannedSpeakingTime(today.plusDays(2)).build();
        when(friendRepository.findAll()).thenReturn(List.of(friend));

        int lapsed = service.applyNightlyLapse();

        assertThat(lapsed).isEqualTo(0);
        verify(friendRepository, never()).save(any());
        verify(leechService, never()).recordMiss(any());
    }

    @Test
    void overdueWithinGracePeriod_isLeftAlone() {
        // 7 days overdue is still within the grace window (> 7 triggers, not >=).
        Friend friend = Friend.builder().id(1).fsrsStability(5.0).fsrsDifficulty(3.0)
            .plannedSpeakingTime(today.minusDays(7)).build();
        when(friendRepository.findAll()).thenReturn(List.of(friend));

        int lapsed = service.applyNightlyLapse();

        assertThat(lapsed).isEqualTo(0);
    }

    @Test
    void neverReviewed_hasNoFsrsState_isSkipped() {
        Friend friend = Friend.builder().id(1).plannedSpeakingTime(today.minusDays(30)).build();
        when(friendRepository.findAll()).thenReturn(List.of(friend));

        int lapsed = service.applyNightlyLapse();

        assertThat(lapsed).isEqualTo(0);
        verify(friendRepository, never()).save(any());
    }

    @Test
    void chronicallyOverdue_getsLapsed_leechMissRecorded_banditStateUntouched() {
        Friend friend = Friend.builder().id(1)
            .fsrsStability(10.0).fsrsDifficulty(4.0)
            .lastInteractionDate(today.minusDays(40))
            .plannedSpeakingTime(today.minusDays(10)) // 10 days overdue > 7-day grace
            .pendingBanditArm(1.25).pendingBanditBucket("dEasy:sShort")
            .build();
        when(friendRepository.findAll()).thenReturn(List.of(friend));

        int lapsed = service.applyNightlyLapse();

        assertThat(lapsed).isEqualTo(1);
        assertThat(friend.getPlannedSpeakingTime()).isAfter(today); // rescheduled into the future
        assertThat(friend.getLastInteractionDate()).isEqualTo(today);
        // forget() collapses stability below its prior value (lapse signature).
        assertThat(friend.getFsrsStability()).isLessThan(10.0);
        // Bandit's pending decision is exogenously voided, not rewarded -- left as-is.
        assertThat(friend.getPendingBanditArm()).isEqualTo(1.25);
        assertThat(friend.getPendingBanditBucket()).isEqualTo("dEasy:sShort");
        verify(leechService).recordMiss(friend);
        verify(friendRepository).save(friend);
    }

    @Test
    void multipleOverdueFriends_spreadAcrossDifferentDays() {
        Friend a = Friend.builder().id(1).fsrsStability(30.0).fsrsDifficulty(4.0)
            .plannedSpeakingTime(today.minusDays(10)).build();
        Friend b = Friend.builder().id(2).fsrsStability(30.0).fsrsDifficulty(4.0)
            .plannedSpeakingTime(today.minusDays(10)).build();
        when(friendRepository.findAll()).thenReturn(List.of(a, b));

        int lapsed = service.applyNightlyLapse();

        assertThat(lapsed).isEqualTo(2);
        // Same starting stability/difficulty -> same new interval window; the
        // least-loaded-day balancer should not stack both on the same date.
        assertThat(a.getPlannedSpeakingTime()).isNotEqualTo(b.getPlannedSpeakingTime());
    }
}
