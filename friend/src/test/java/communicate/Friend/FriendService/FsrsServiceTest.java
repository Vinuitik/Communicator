package communicate.Friend.FriendService;

import communicate.Friend.FriendService.FsrsService.FsrsState;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static communicate.Friend.FriendService.FsrsService.GRADE_EASY;
import static communicate.Friend.FriendService.FsrsService.GRADE_GOOD;
import static communicate.Friend.FriendService.FsrsService.GRADE_HARD;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.within;

/**
 * Pinned against py-fsrs (FSRS-6, default parameters, desired retention 0.9)
 * — same reference values as OO's FsrsServiceTest, since this class is a
 * verbatim port of OO's FsrsService. Only intervalDays' signature differs
 * (desiredRetention is now a parameter, not an injected field), so every
 * assertion below passes 0.9 explicitly where OO relied on ReflectionTestUtils.
 */
class FsrsServiceTest {

    private static final double TOL = 1e-4;
    private static final double DR = 0.9;

    private FsrsService fsrs;

    @BeforeEach
    void setUp() {
        fsrs = new FsrsService();
    }

    // ── First review ──────────────────────────────────────────────────────────

    @Test
    void firstReview_hard() {
        FsrsState s = fsrs.initialState(GRADE_HARD);
        assertThat(s.stability()).isCloseTo(1.293100, within(TOL));
        assertThat(s.difficulty()).isCloseTo(5.112171, within(TOL));
        assertThat(fsrs.intervalDays(s.stability(), DR)).isEqualTo(1);
    }

    @Test
    void firstReview_good() {
        FsrsState s = fsrs.initialState(GRADE_GOOD);
        assertThat(s.stability()).isCloseTo(2.306500, within(TOL));
        assertThat(s.difficulty()).isCloseTo(2.118104, within(TOL));
        assertThat(fsrs.intervalDays(s.stability(), DR)).isEqualTo(2);
    }

    @Test
    void firstReview_easy() {
        FsrsState s = fsrs.initialState(GRADE_EASY);
        assertThat(s.stability()).isCloseTo(8.295600, within(TOL));
        assertThat(s.difficulty()).isEqualTo(1.0); // raw D0(Easy) is negative -> clamped
        assertThat(fsrs.intervalDays(s.stability(), DR)).isEqualTo(8);
    }

    // ── Second review (state, grade, elapsed) -> py-fsrs reference ─────────────

    @Test
    void goodThenGood_elapsed3() {
        FsrsState s = fsrs.review(fsrs.initialState(GRADE_GOOD), GRADE_GOOD, 3);
        assertThat(s.stability()).isCloseTo(13.826904, within(TOL));
        assertThat(s.difficulty()).isCloseTo(2.111214, within(TOL));
        assertThat(fsrs.intervalDays(s.stability(), DR)).isEqualTo(14);
    }

    @Test
    void goodThenEasy_elapsed3() {
        FsrsState s = fsrs.review(fsrs.initialState(GRADE_GOOD), GRADE_EASY, 3);
        assertThat(s.stability()).isCloseTo(23.883064, within(TOL));
        assertThat(s.difficulty()).isEqualTo(1.0);
        assertThat(fsrs.intervalDays(s.stability(), DR)).isEqualTo(24);
    }

    @Test
    void goodThenHard_elapsed3() {
        FsrsState s = fsrs.review(fsrs.initialState(GRADE_GOOD), GRADE_HARD, 3);
        assertThat(s.stability()).isCloseTo(9.234871, within(TOL));
        assertThat(s.difficulty()).isCloseTo(4.752858, within(TOL));
        assertThat(fsrs.intervalDays(s.stability(), DR)).isEqualTo(9);
    }

    @Test
    void lateReview_growsStabilityMore() {
        FsrsState s = fsrs.review(fsrs.initialState(GRADE_GOOD), GRADE_GOOD, 10);
        assertThat(s.stability()).isCloseTo(25.108720, within(TOL));
        assertThat(fsrs.intervalDays(s.stability(), DR)).isEqualTo(25);
    }

    @Test
    void earlyReview_growsStabilityLess() {
        FsrsState s = fsrs.review(fsrs.initialState(GRADE_GOOD), GRADE_GOOD, 1);
        assertThat(s.stability()).isCloseTo(7.315301, within(TOL));
        assertThat(fsrs.intervalDays(s.stability(), DR)).isEqualTo(7);
    }

    @Test
    void easyThenGood_elapsed15() {
        FsrsState s = fsrs.review(fsrs.initialState(GRADE_EASY), GRADE_GOOD, 15);
        assertThat(s.stability()).isCloseTo(54.860918, within(TOL));
        assertThat(fsrs.intervalDays(s.stability(), DR)).isEqualTo(55);
    }

    @Test
    void hardThenHard_elapsed2() {
        FsrsState s = fsrs.review(fsrs.initialState(GRADE_HARD), GRADE_HARD, 2);
        assertThat(s.stability()).isCloseTo(4.469455, within(TOL));
        assertThat(s.difficulty()).isCloseTo(6.740460, within(TOL));
        assertThat(fsrs.intervalDays(s.stability(), DR)).isEqualTo(4);
    }

    @Test
    void threeReviewChain() {
        FsrsState s = fsrs.initialState(GRADE_GOOD);
        s = fsrs.review(s, GRADE_GOOD, 3);
        s = fsrs.review(s, GRADE_GOOD, 7);
        assertThat(s.stability()).isCloseTo(39.174976, within(TOL));
        assertThat(s.difficulty()).isCloseTo(2.104331, within(TOL));
        assertThat(fsrs.intervalDays(s.stability(), DR)).isEqualTo(39);
    }

    // ── Forget / lapse path (py-fsrs Rating.Again reference) ──────────────────

    @Test
    void forget_afterGood_elapsed3() {
        FsrsState s = fsrs.forget(fsrs.initialState(GRADE_GOOD), 3);
        assertThat(s.stability()).isCloseTo(0.636851, within(TOL));
        assertThat(s.difficulty()).isCloseTo(7.394503, within(TOL));
        assertThat(fsrs.intervalDays(s.stability(), DR)).isEqualTo(1);
    }

    @Test
    void forget_afterGood_elapsed10_lateReviewRaisesStabilitySlightly() {
        FsrsState s = fsrs.forget(fsrs.initialState(GRADE_GOOD), 10);
        assertThat(s.stability()).isCloseTo(0.759160, within(TOL));
        assertThat(s.difficulty()).isCloseTo(7.394503, within(TOL));
    }

    @Test
    void forget_afterEasy_elapsed15() {
        FsrsState s = fsrs.forget(fsrs.initialState(GRADE_EASY), 15);
        assertThat(s.stability()).isCloseTo(1.502927, within(TOL));
        assertThat(s.difficulty()).isCloseTo(7.026990, within(TOL));
        assertThat(fsrs.intervalDays(s.stability(), DR)).isEqualTo(2);
    }

    @Test
    void forget_afterHard_elapsed2() {
        FsrsState s = fsrs.forget(fsrs.initialState(GRADE_HARD), 2);
        assertThat(s.stability()).isCloseTo(0.407175, within(TOL));
        assertThat(s.difficulty()).isCloseTo(8.378632, within(TOL));
    }

    @Test
    void forget_collapsesStability_belowPriorAndRaisesDifficulty() {
        FsrsState prior = fsrs.review(fsrs.initialState(GRADE_GOOD), GRADE_GOOD, 3);
        FsrsState lapsed = fsrs.forget(prior, 7);
        assertThat(lapsed.stability()).isCloseTo(1.614598, within(TOL));
        assertThat(lapsed.difficulty()).isCloseTo(7.392238, within(TOL));
        assertThat(lapsed.stability()).isLessThan(prior.stability());   // memory dropped
        assertThat(lapsed.difficulty()).isGreaterThan(prior.difficulty()); // harder now
    }

    // ── Properties / guards ───────────────────────────────────────────────────

    @Test
    void retrievabilityAtStabilityDaysIs90Percent() {
        assertThat(fsrs.retrievability(10, 10)).isCloseTo(0.9, within(1e-9));
    }

    @Test
    void sameDayReviewDoesNotGrowStability() {
        FsrsState first = fsrs.initialState(GRADE_GOOD);
        FsrsState again = fsrs.review(first, GRADE_GOOD, 0);
        assertThat(again.stability()).isCloseTo(first.stability(), within(TOL));
    }

    @Test
    void againGradeIsRejected_noFireOnFailByDesign() {
        assertThatThrownBy(() -> fsrs.initialState(1))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("no Again");
        assertThatThrownBy(() -> fsrs.review(fsrs.initialState(GRADE_GOOD), 1, 3))
            .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void intervalNeverBelowOneDay() {
        assertThat(fsrs.intervalDays(0.001, DR)).isEqualTo(1);
    }

    @Test
    void higherDesiredRetention_shortensInterval() {
        FsrsState s = fsrs.initialState(GRADE_GOOD);
        int loose = fsrs.intervalDays(s.stability(), 0.8);
        int strict = fsrs.intervalDays(s.stability(), 0.97);
        assertThat(strict).isLessThan(loose);
    }
}
