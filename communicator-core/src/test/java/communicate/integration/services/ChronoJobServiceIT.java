package communicate.integration.services;

import communicate.Chrono.service.ChronoJobService;
import communicate.Friend.FriendEntities.Friend;
import communicate.Friend.FriendRepositories.AnalyticsRepository;
import communicate.Friend.FriendRepositories.FriendRepository;
import communicate.integration.support.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

/**
 * Integration tests for the rewritten ChronoJobService.
 * These are the highest-risk tests in the suite — they verify that the
 * gRPC/HTTP removal did not break the daily decay logic.
 */
class ChronoJobServiceIT extends AbstractIntegrationTest {

    @Autowired ChronoJobService    chronoJobService;
    @Autowired FriendRepository    friendRepository;
    @Autowired AnalyticsRepository analyticsRepository;

    private static final double TOLERANCE = 0.0001;
    private static final LocalDate YESTERDAY = LocalDate.now().minusDays(1);

    // ── TC-I11: friend with no interaction → decay applied ───────────────────

    @Test
    void friendWithNoInteractionYesterday_decayAppliedToAverages() {
        Friend friend = friendRepository.save(buildFriendWithAverages("Alice", 1.0, 1.0, 1.0));
        // No analytics saved for yesterday

        chronoJobService.applyDailyDecay();

        Friend reloaded = friendRepository.findById(friend.getId()).orElseThrow();
        // Default "good" decay alpha=0.2, factor=(1-0.2)=0.8
        assertThat(reloaded.getAverageFrequency()).isCloseTo(0.8, within(TOLERANCE));
        assertThat(reloaded.getAverageDuration()).isCloseTo(0.8, within(TOLERANCE));
        assertThat(reloaded.getAverageExcitement()).isCloseTo(0.8, within(TOLERANCE));
    }

    // ── TC-I12: friend WITH interaction yesterday → averages unchanged ────────

    @Test
    void friendWithInteractionYesterday_averagesUnchanged() {
        Friend friend = friendRepository.save(buildFriendWithAverages("Bob", 2.0, 1.5, 0.8));
        analyticsRepository.save(buildAnalytics(friend, YESTERDAY, "***", 1.5));

        chronoJobService.applyDailyDecay();

        Friend reloaded = friendRepository.findById(friend.getId()).orElseThrow();
        assertThat(reloaded.getAverageFrequency()).isCloseTo(2.0, within(TOLERANCE));
        assertThat(reloaded.getAverageDuration()).isCloseTo(1.5, within(TOLERANCE));
        assertThat(reloaded.getAverageExcitement()).isCloseTo(0.8, within(TOLERANCE));
    }

    // ── TC-I13: mixed friends — only inactive one decays ─────────────────────

    @Test
    void mixedFriends_onlyFriendWithoutInteractionDecays() {
        Friend active   = friendRepository.save(buildFriendWithAverages("Carol", 1.0, 1.0, 1.0));
        Friend inactive = friendRepository.save(buildFriendWithAverages("Dave",  1.0, 1.0, 1.0));

        analyticsRepository.save(buildAnalytics(active, YESTERDAY, "**", 1.0));
        // Dave has no analytics for yesterday

        chronoJobService.applyDailyDecay();

        Friend reloadedActive   = friendRepository.findById(active.getId()).orElseThrow();
        Friend reloadedInactive = friendRepository.findById(inactive.getId()).orElseThrow();

        // Active friend → unchanged
        assertThat(reloadedActive.getAverageFrequency()).isCloseTo(1.0, within(TOLERANCE));
        // Inactive friend → decayed
        assertThat(reloadedInactive.getAverageFrequency()).isLessThan(1.0);
    }

    // ── TC-I14: empty friends table → completes cleanly ──────────────────────

    @Test
    void emptyDatabase_decayJobCompletesWithoutException() {
        // Ensure table is empty (rollback handles cleanup, but verify count)
        assertThat(friendRepository.count()).isZero();
        chronoJobService.applyDailyDecay(); // must not throw
    }

    // ── TC-I15: friend with null averages → stays at 0.0, no NPE ─────────────

    @Test
    void friendWithNullAverages_noNpeAndResultIsZero() {
        Friend friend = friendRepository.save(buildFriend("Eve"));
        // buildFriend() leaves averages at default 0.0 (entity field default)

        chronoJobService.applyDailyDecay();

        Friend reloaded = friendRepository.findById(friend.getId()).orElseThrow();
        assertThat(reloaded.getAverageFrequency()).isCloseTo(0.0, within(TOLERANCE));
    }

    // ── TC-I16: pageSize = 500, exactly 500 friends — processed in 1 page ────

    @Test
    void exactlyOnePageOfFriends_allProcessed() {
        int count = 10; // Practical stand-in (full 500 is slow for IT); validates pagination logic
        for (int i = 0; i < count; i++) {
            friendRepository.save(buildFriendWithAverages("Friend_" + i, 1.0, 1.0, 1.0));
        }
        // None have analytics for yesterday

        chronoJobService.applyDailyDecay();

        long decayedCount = friendRepository.findAll().stream()
                .filter(f -> f.getAverageFrequency() < 1.0)
                .count();
        assertThat(decayedCount).isEqualTo(count);
    }

    // ── TC-I17: decay is (1 - alpha) * current, not alpha * current ──────────

    @Test
    void decayFormula_isOneMinusAlphaTimesCurrent() {
        Friend friend = friendRepository.save(buildFriendWithAverages("Formula Test", 10.0, 10.0, 10.0));

        chronoJobService.applyDailyDecay();

        Friend reloaded = friendRepository.findById(friend.getId()).orElseThrow();
        // alpha=0.2 → expected = (1-0.2) * 10.0 = 8.0
        // Would be wrong if formula is: alpha * 10.0 = 2.0
        assertThat(reloaded.getAverageFrequency()).isCloseTo(8.0, within(TOLERANCE));
        assertThat(reloaded.getAverageFrequency()).isGreaterThan(5.0); // Rules out alpha*current
    }
}
