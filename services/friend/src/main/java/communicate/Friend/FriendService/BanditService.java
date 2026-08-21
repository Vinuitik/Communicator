package communicate.Friend.FriendService;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;

import org.springframework.stereotype.Service;

import communicate.Friend.FriendEntities.BanditArm;
import communicate.Friend.FriendEntities.BanditArmId;
import communicate.Friend.FriendRepositories.BanditArmRepository;

/**
 * Thompson Sampling over interval multipliers — ported from ObsidianOptimizer's
 * BanditService. Mechanism unchanged (interval-weighted reward, effective-arm
 * attribution done by the caller, discounted Beta for non-stationarity — see
 * OO's class doc for the full rationale); only {@link #bucket} differs: 4
 * cells (2 stability x 2 difficulty) with relationship-scale cutoffs, not
 * OO's 9 (3x3) flashcard-scale cutoffs (design doc premises 5-7 — pooling
 * across dozens of friends with weekly-at-best events is data-starved at 9
 * cells; a 35-day gap and a 6-month gap must not land in the same bucket).
 *
 * Bankruptcy/chronic-neglect lapses are deliberately NOT fed here — exogenous
 * (the user didn't reach out), not a memory signal. Same exclusion as OO.
 */
@Service
public class BanditService {

    /** Asymmetric grid: no sub-0.85 compression, expansion room up to a hard 2.0 ceiling. */
    public static final double[] ARMS = {0.85, 1.0, 1.25, 1.5, 2.0};

    /** Reward normaliser and attribution ceiling — the largest arm. */
    public static final double MAX_ARM = 2.0;

    /** Beta discount per update (relax toward prior). Effective memory ~ 1/(1-y) ~ 33 obs. */
    static final double DISCOUNT = 0.97;

    // Relationship-scale cutpoint (design doc premise 7): OO's flashcard
    // bands (<7d/7-30d/>30d) treat "long-term" as starting at a month, which
    // is too short here — a 35-day gap and a 6-month gap would land in the
    // same bucket. Single cutpoint since premise 6 locks 2 stability tiers,
    // not OO's 3. Starting guess, TBD, retune with real data.
    private static final double STABILITY_CUTOFF_DAYS = 90;

    // Difficulty stays the same 1-10 FSRS scale as OO (unaffected by the
    // relationship-vs-flashcard timescale distinction) — midpoint split
    // since premise 6 locks 2 difficulty tiers, not OO's 3 (terciles at
    // <4/4-7/>7). Starting guess, TBD, retune with real data.
    private static final double DIFFICULTY_CUTOFF = 5.5;

    private final BanditArmRepository banditArmRepository;
    private Random random = new Random();

    public BanditService(BanditArmRepository banditArmRepository) {
        this.banditArmRepository = banditArmRepository;
    }

    /** 2 difficulty tiers x 2 stability tiers — 4 cells (design doc premise 6). */
    public String bucket(double difficulty, double stability) {
        String d = difficulty < DIFFICULTY_CUTOFF ? "dEasy" : "dHard";
        String s = stability < STABILITY_CUTOFF_DAYS ? "sShort" : "sLong";
        return d + ":" + s;
    }

    /** Sample every arm's Beta for this bucket, return the argmax multiplier. */
    public double chooseArm(String bucket) {
        Map<Double, double[]> params = loadParams(bucket);
        double bestArm = 1.0, bestSample = -1;
        for (double arm : ARMS) {
            double[] ab = params.getOrDefault(arm, new double[]{1, 1});
            double sample = sampleBeta(ab[0], ab[1]);
            if (sample > bestSample) {
                bestSample = sample;
                bestArm = arm;
            }
        }
        return bestArm;
    }

    /** Snap a raw realised multiplier to the nearest arm; clamps above MAX_ARM. */
    public double snapArm(double rawMultiplier) {
        double best = ARMS[0];
        double bestDist = Math.abs(rawMultiplier - best);
        for (double arm : ARMS) {
            double dist = Math.abs(rawMultiplier - arm);
            if (dist < bestDist) { bestDist = dist; best = arm; }
        }
        return best;
    }

    /**
     * Delayed reward from the next interaction, credited to the EFFECTIVE
     * arm (the interval the friend was really contacted at, snapped to the
     * grid). Reward = recalled ? snappedArm / MAX_ARM : 0. Update relaxes
     * toward the (1,1) prior first (DISCOUNT), then adds the fractional
     * reward.
     */
    public void reward(String bucket, double rawEffectiveMultiplier, boolean recalled) {
        double arm = snapArm(rawEffectiveMultiplier);
        double r = recalled ? arm / MAX_ARM : 0.0;

        double[] ab = loadParams(bucket).getOrDefault(arm, new double[]{1, 1});
        double alpha = 1 + DISCOUNT * (ab[0] - 1) + r;
        double beta  = 1 + DISCOUNT * (ab[1] - 1) + (1 - r);

        banditArmRepository.save(new BanditArm(new BanditArmId(bucket, arm), alpha, beta));
    }

    private Map<Double, double[]> loadParams(String bucket) {
        List<BanditArm> rows = banditArmRepository.findByIdContextBucket(bucket);
        Map<Double, double[]> params = new HashMap<>();
        for (BanditArm row : rows) {
            params.put(row.getId().getArm(), new double[]{row.getAlpha(), row.getBeta()});
        }
        return params;
    }

    // ── Beta sampling via two Gammas (Marsaglia-Tsang), no extra dependency ──

    double sampleBeta(double alpha, double beta) {
        double x = sampleGamma(alpha);
        double y = sampleGamma(beta);
        return x / (x + y);
    }

    private double sampleGamma(double shape) {
        if (shape < 1) {
            // Johnk boost: Gamma(a) = Gamma(a+1) * U^(1/a)
            return sampleGamma(shape + 1) * Math.pow(random.nextDouble(), 1.0 / shape);
        }
        double d = shape - 1.0 / 3.0;
        double c = 1.0 / Math.sqrt(9.0 * d);
        while (true) {
            double x = random.nextGaussian();
            double v = 1.0 + c * x;
            if (v <= 0) continue;
            v = v * v * v;
            double u = random.nextDouble();
            if (u < 1 - 0.0331 * x * x * x * x) return d * v;
            if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
        }
    }

    /** Test hook — deterministic sampling. */
    void setRandom(Random random) {
        this.random = random;
    }
}
