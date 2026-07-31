package communicate.Friend.FriendService;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * FSRS-6 (recall path only) — verbatim port of ObsidianOptimizer's
 * FsrsService (py-fsrs's scheduler math). Ported unchanged; only the grade
 * *computation feeding it* is new to Communicator (see design doc's State
 * Translation Design).
 *
 * Deliberately absent (decisions carried over from OO, see FLASHCARDS_ARCH):
 * - the "Again"/lapse path (w11-w14): no fire-on-fail — the worst grade is Hard
 * - same-day review handling (w17-w19): reviews are day-granularity
 *
 * Subtlety preserved from py-fsrs: difficulty mean-reversion uses the RAW
 * (unclamped) initial difficulty of Easy, which is negative with default
 * weights — clamping it would shift every difficulty update.
 */
@Service
public class FsrsService {

    /** FSRS-6 default weights (py-fsrs 6.x DEFAULT_PARAMETERS). */
    static final double[] W = {
        0.212, 1.2931, 2.3065, 8.2956, 6.4133, 0.8334, 3.0194, 0.001,
        1.8722, 0.1666, 0.796, 1.4835, 0.0614, 0.2629, 1.6483, 0.6014,
        1.8729, 0.5425, 0.0912, 0.0658, 0.1542,
    };

    private static final double DECAY  = -W[20];
    private static final double FACTOR = Math.pow(0.9, 1.0 / DECAY) - 1.0;

    /** Lapse grade — never user-pressable; reached only via {@link #forget} (7-day rule, bankruptcy). */
    public static final int GRADE_AGAIN = 1;
    public static final int GRADE_HARD = 2;
    public static final int GRADE_GOOD = 3;
    public static final int GRADE_EASY = 4;

    private static final double STABILITY_MIN = 0.001;
    private static final int    MAX_INTERVAL_DAYS = 36500;

    @Value("${fsrs.desired-retention:0.9}")
    private double desiredRetention;

    public record FsrsState(double stability, double difficulty) {}

    // ── First review ──────────────────────────────────────────────────────────

    public FsrsState initialState(int grade) {
        requireGrade(grade);
        return new FsrsState(W[grade - 1], clampDifficulty(rawInitialDifficulty(grade)));
    }

    // ── Subsequent reviews ────────────────────────────────────────────────────

    public FsrsState review(FsrsState state, int grade, double elapsedDays) {
        requireGrade(grade);
        double r = retrievability(elapsedDays, state.stability());
        double newStability  = recallStability(state.difficulty(), state.stability(), r, grade);
        double newDifficulty = nextDifficulty(state.difficulty(), grade);
        return new FsrsState(clampStability(newStability), newDifficulty);
    }

    /**
     * Lapse / forget path (py-fsrs {@code _next_forget_stability} + Again-grade
     * difficulty). Reached only when a note is reviewed >7 days late or swept by
     * a bankruptcy declaration — never from a user-pressed band. Stability
     * collapses toward a short post-lapse value; difficulty jumps (grade Again).
     */
    public FsrsState forget(FsrsState state, double elapsedDays) {
        double r = retrievability(elapsedDays, state.stability());
        double sf = W[11]
            * Math.pow(state.difficulty(), -W[12])
            * (Math.pow(state.stability() + 1.0, W[13]) - 1.0)
            * Math.exp(W[14] * (1.0 - r));
        double newDifficulty = nextDifficulty(state.difficulty(), GRADE_AGAIN);
        return new FsrsState(clampStability(sf), newDifficulty);
    }

    /** Probability of recall after elapsedDays at the given stability. */
    public double retrievability(double elapsedDays, double stability) {
        return Math.pow(1.0 + FACTOR * Math.max(0, elapsedDays) / stability, DECAY);
    }

    /** Days until retrievability decays to desired retention. Always >= 1. */
    public int intervalDays(double stability) {
        double interval = (stability / FACTOR)
            * (Math.pow(desiredRetention, 1.0 / DECAY) - 1.0);
        return (int) Math.min(Math.max(Math.round(interval), 1), MAX_INTERVAL_DAYS);
    }

    // ── FSRS-6 internals ──────────────────────────────────────────────────────

    private static double recallStability(double d, double s, double r, int grade) {
        double hardPenalty = grade == GRADE_HARD ? W[15] : 1.0;
        double easyBonus   = grade == GRADE_EASY ? W[16] : 1.0;
        return s * (1.0
            + Math.exp(W[8])
            * (11.0 - d)
            * Math.pow(s, -W[9])
            * (Math.exp(W[10] * (1.0 - r)) - 1.0)
            * hardPenalty
            * easyBonus);
    }

    private static double rawInitialDifficulty(int grade) {
        return W[4] - Math.exp(W[5] * (grade - 1)) + 1.0;
    }

    private static double nextDifficulty(double d, int grade) {
        double deltaD = -W[6] * (grade - 3);
        double damped = d + deltaD * (10.0 - d) / 9.0;
        // mean reversion toward the UNCLAMPED Easy initial difficulty
        double reverted = W[7] * rawInitialDifficulty(GRADE_EASY) + (1.0 - W[7]) * damped;
        return clampDifficulty(reverted);
    }

    private static double clampDifficulty(double d) {
        return Math.min(Math.max(d, 1.0), 10.0);
    }

    /**
     * Legacy migration helper: map a legacy star-rating-derived scale onto an
     * FSRS difficulty (1–10), inverted — lower input means the interaction was
     * "harder" (worse). Used to seed FSRS difficulty from legacy EMA state so a
     * migrated friend keeps its rough timeline instead of resetting to neutral
     * (see design doc's cold-start/backfill step).
     */
    public static double easeToDifficulty(int ease) {
        return clampDifficulty(11.0 - ease / 50.0);
    }

    private static double clampStability(double s) {
        return Math.min(Math.max(s, STABILITY_MIN), MAX_INTERVAL_DAYS);
    }

    private static void requireGrade(int grade) {
        if (grade < GRADE_HARD || grade > GRADE_EASY) {
            throw new IllegalArgumentException(
                "grade must be 2 (Hard), 3 (Good) or 4 (Easy) — there is no Again/lapse grade by design");
        }
    }
}
