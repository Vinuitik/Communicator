package communicate.Friend.FriendService;

import communicate.Friend.FriendEntities.BanditArm;
import communicate.Friend.FriendEntities.BanditArmId;
import communicate.Friend.FriendRepositories.BanditArmRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Random;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Math-level tests for Thompson Sampling — ported from OO's BanditServiceTest.
 * Mechanism (Beta sampler, arm snapping, discounted reward) is unchanged from
 * OO; only bucket() and the persistence layer differ (JPA repository instead
 * of raw JdbcTemplate — see BanditArm/BanditArmRepository).
 */
@ExtendWith(MockitoExtension.class)
class BanditServiceTest {

    @Mock BanditArmRepository repository;

    // ── Beta sampler ─────────────────────────────────────────────────────────

    @Test
    void sampleBeta_isInUnitInterval_andSeedStable() {
        BanditService bandit = new BanditService(repository);
        bandit.setRandom(new Random(42));
        for (int i = 0; i < 1000; i++) {
            assertThat(bandit.sampleBeta(1, 1)).isBetween(0.0, 1.0);
        }
    }

    @Test
    void sampleBeta_concentratesAroundMean() {
        BanditService bandit = new BanditService(repository);
        bandit.setRandom(new Random(7));
        double sum = 0;
        for (int i = 0; i < 2000; i++) sum += bandit.sampleBeta(80, 20);
        assertThat(sum / 2000).isCloseTo(0.8, org.assertj.core.data.Offset.offset(0.01));
    }

    @Test
    void sampleBeta_skewsTowardEvidence() {
        BanditService bandit = new BanditService(repository);
        bandit.setRandom(new Random(3));
        int wins = 0;
        for (int i = 0; i < 500; i++) {
            if (bandit.sampleBeta(20, 2) > bandit.sampleBeta(2, 20)) wins++;
        }
        assertThat(wins).isGreaterThan(490);
    }

    // ── bucket() — 4 cells, relationship-scale cutoffs (design doc premises 6-7) ──

    @Test
    void bucket_partitionsDifficultyAndStability_into4Cells() {
        BanditService bandit = new BanditService(repository);
        assertThat(bandit.bucket(2.0, 30.0)).isEqualTo("dEasy:sShort");   // difficulty < 5.5, stability < 90d
        assertThat(bandit.bucket(2.0, 120.0)).isEqualTo("dEasy:sLong");   // difficulty < 5.5, stability >= 90d
        assertThat(bandit.bucket(8.0, 30.0)).isEqualTo("dHard:sShort");  // difficulty >= 5.5, stability < 90d
        assertThat(bandit.bucket(8.0, 120.0)).isEqualTo("dHard:sLong");  // difficulty >= 5.5, stability >= 90d
    }

    @Test
    void bucket_cutpointsAreExactBoundaries() {
        BanditService bandit = new BanditService(repository);
        assertThat(bandit.bucket(5.4, 89.0)).isEqualTo("dEasy:sShort");
        assertThat(bandit.bucket(5.5, 90.0)).isEqualTo("dHard:sLong");
    }

    // ── Arm snapping (effective-arm attribution + ratchet clamp) ─────────────

    @Test
    void snapArm_picksNearestGridArm() {
        BanditService bandit = new BanditService(repository);
        assertThat(bandit.snapArm(1.05)).isEqualTo(1.0);
        assertThat(bandit.snapArm(1.30)).isEqualTo(1.25);
        assertThat(bandit.snapArm(1.40)).isEqualTo(1.5);
    }

    @Test
    void snapArm_clampsHugeProcrastinationToCeiling() {
        BanditService bandit = new BanditService(repository);
        assertThat(bandit.snapArm(5.0)).isEqualTo(2.0);
    }

    @Test
    void snapArm_clampsVeryEarlyReviewToFloor() {
        BanditService bandit = new BanditService(repository);
        assertThat(bandit.snapArm(0.2)).isEqualTo(0.85);
    }

    // ── Interval-weighted discounted reward ──────────────────────────────────

    @Test
    void reward_recalled_isIntervalWeighted_andDiscountsTowardPrior() {
        when(repository.findByIdContextBucket("dHard:sLong")).thenReturn(
            List.of(new BanditArm(new BanditArmId("dHard:sLong", 2.0), 5.0, 2.0)));
        BanditService bandit = new BanditService(repository);

        // Recalled at effective 2.0 -> r = 2.0/2.0 = 1.0.
        // alpha = 1 + 0.97*(5-1) + 1 = 5.88 ; beta = 1 + 0.97*(2-1) + 0 = 1.97
        bandit.reward("dHard:sLong", 2.0, true);

        BanditArm saved = captureSave(repository);
        assertThat(saved.getAlpha()).isCloseTo(5.88, org.assertj.core.data.Offset.offset(1e-9));
        assertThat(saved.getBeta()).isCloseTo(1.97, org.assertj.core.data.Offset.offset(1e-9));
    }

    @Test
    void reward_shortArm_paysLessThanLongArm_forSameRecall() {
        when(repository.findByIdContextBucket(anyString())).thenReturn(List.of()); // fresh prior {1,1}
        BanditService bandit = new BanditService(repository);

        bandit.reward("dEasy:sShort", 0.85, true); // r = 0.85/2.0 = 0.425
        double shortAlpha = captureSave(repository).getAlpha();
        bandit.reward("dEasy:sShort", 1.5, true);  // r = 1.5/2.0 = 0.75
        double longAlpha = captureSave(repository).getAlpha();

        // Stretching further is worth more alpha -- anti-"always compress" bias mechanism.
        assertThat(longAlpha).isGreaterThan(shortAlpha);
    }

    @Test
    void reward_forgotten_paysZero_allMassToBeta() {
        when(repository.findByIdContextBucket(anyString())).thenReturn(List.of()); // prior {1,1}
        BanditService bandit = new BanditService(repository);

        bandit.reward("dHard:sLong", 1.5, false); // r = 0
        BanditArm saved = captureSave(repository);
        assertThat(saved.getAlpha()).isCloseTo(1.0, org.assertj.core.data.Offset.offset(1e-9));
        assertThat(saved.getBeta()).isCloseTo(2.0, org.assertj.core.data.Offset.offset(1e-9));
    }

    @Test
    void chooseArm_withNoHistory_stillReturnsAGridArm() {
        when(repository.findByIdContextBucket(anyString())).thenReturn(List.of());
        BanditService bandit = new BanditService(repository);
        bandit.setRandom(new Random(1));

        double arm = bandit.chooseArm("dEasy:sShort");
        assertThat(BanditService.ARMS).contains(arm);
    }

    private static BanditArm captureSave(BanditArmRepository repository) {
        ArgumentCaptor<BanditArm> captor = ArgumentCaptor.forClass(BanditArm.class);
        verify(repository, org.mockito.Mockito.atLeastOnce()).save(captor.capture());
        return captor.getValue();
    }
}
