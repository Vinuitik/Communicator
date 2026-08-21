package communicate.Friend.FriendService;

import org.springframework.stereotype.Service;

import communicate.Friend.FriendRepositories.AnalyticsRepository;

/**
 * Collapses the raw per-interaction signals (duration, intensity, proximity)
 * into one FSRS-shaped grade (GRADE_HARD..GRADE_EASY) — the design doc's
 * "State Translation Design", the real new work this port requires since
 * ObsidianOptimizer only ever carried one fused (stability, difficulty) pair
 * fed by a user-pressed button, not multiple raw signals.
 *
 * Frequency is deliberately NOT an input here — it's already structurally
 * captured via elapsedDays at the FsrsService.review() call site (premise 8;
 * feeding average_frequency in here too would double-count the same signal
 * through two channels).
 */
@Service
public class GradeComputationService {

    // Closed 3-value star scale (EmaMathService.experienceToNumber: 1.0-3.0)
    // — fixed bounds, not data-dependent, unlike duration below.
    private static final double INTENSITY_MIN = 1.0;
    private static final double INTENSITY_MAX = 3.0;

    // Equal weighting between duration and intensity — starting guess per
    // the design doc's "combine(duration_norm, intensity_norm) # e.g.
    // weighted avg"; no data yet to justify skewing either way.
    private static final double DURATION_WEIGHT = 0.5;
    private static final double INTENSITY_WEIGHT = 0.5;

    // In-person hangouts count for more than a remote one of the same
    // duration/intensity (design doc premise 9's grade-modifier role for
    // proximity). Starting guess — doc's Open Questions flags the exact
    // value as TBD, tune with data.
    private static final double IN_PERSON_MULTIPLIER = 1.15;
    private static final double REMOTE_MULTIPLIER = 1.0;

    // Grade-band cutpoints, adapted from OO's ReviewService.Band 40/70/90
    // down to 2 cutpoints since Communicator's grade only has 3 usable values
    // (Hard/Good/Easy — Again is unreachable from a computed grade, only
    // from FsrsService.forget()). TBD per design doc, retune with data.
    private static final double HARD_CUTOFF = 0.40;
    private static final double EASY_CUTOFF = 0.70;

    private final AnalyticsRepository analyticsRepository;
    private final EmaMathService emaMath;

    public GradeComputationService(AnalyticsRepository analyticsRepository, EmaMathService emaMath) {
        this.analyticsRepository = analyticsRepository;
        this.emaMath = emaMath;
    }

    /** @return one of FsrsService.GRADE_HARD / GRADE_GOOD / GRADE_EASY. */
    public int computeGrade(double durationHours, String experience, Boolean inPerson) {
        double durationNorm = minmax(durationHours, analyticsRepository.findMinHours(), analyticsRepository.findMaxHours());
        double intensityNorm = minmax(emaMath.experienceToNumber(experience), INTENSITY_MIN, INTENSITY_MAX);

        double baseGradeRaw = DURATION_WEIGHT * durationNorm + INTENSITY_WEIGHT * intensityNorm;
        double proximityMultiplier = Boolean.TRUE.equals(inPerson) ? IN_PERSON_MULTIPLIER : REMOTE_MULTIPLIER;
        double effectiveGrade = Math.min(1.0, baseGradeRaw * proximityMultiplier);

        return nearestBand(effectiveGrade);
    }

    private static int nearestBand(double effectiveGrade) {
        if (effectiveGrade < HARD_CUTOFF) return FsrsService.GRADE_HARD;
        if (effectiveGrade < EASY_CUTOFF) return FsrsService.GRADE_GOOD;
        return FsrsService.GRADE_EASY;
    }

    /**
     * Global minmax, queried fresh per call rather than cached/nightly-
     * recomputed. The design doc's Open Questions suggest periodic recompute
     * for cost reasons, but at this project's scale (dozens of friends,
     * weekly-at-best events — premises 5/6) a single aggregate query per
     * logged interaction is negligible; add caching only if real volume
     * shows it's needed.
     */
    private static double minmax(double value, Double min, Double max) {
        if (min == null || max == null || max <= min) {
            return 0.5; // no data yet, or a single distinct value so far
        }
        return Math.min(1.0, Math.max(0.0, (value - min) / (max - min)));
    }
}
