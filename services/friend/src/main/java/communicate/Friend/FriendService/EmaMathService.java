package communicate.Friend.FriendService;

import org.springframework.stereotype.Service;

/**
 * Single arithmetic primitive shared by every EMA call site (immediate
 * per-interaction update, nightly no-interaction decay, and the historical
 * day-by-day series used for charts). Each site still decides its own alpha
 * and raw value — this only owns the one formula shape, so the three call
 * sites can never independently drift on how the math itself works.
 */
@Service
public class EmaMathService {

    /** EMA = alpha * rawValue + (1 - alpha) * current. */
    public double applyNewValue(double current, double alpha, double rawValue) {
        return alpha * rawValue + (1 - alpha) * current;
    }

    /** EMA = current * (1 - decayAlpha). */
    public double applyDecay(double current, double decayAlpha) {
        return current * (1 - decayAlpha);
    }

    /** Star-rating -> numeric value, shared by the excitement/intensity signal. */
    public double experienceToNumber(String experience) {
        if (experience == null) return 2.0;
        return switch (experience) {
            case "*" -> 1.0;
            case "**" -> 2.0;
            case "***" -> 3.0;
            default -> 2.0;
        };
    }

    /**
     * Proximity's raw new-value: 1.0 in-person, 0.0 remote, 0.5 (neutral)
     * when unknown — legacy rows and any log path that doesn't collect it
     * yet. Placeholder weighting; see design doc's proximity-multiplier open
     * question for scheduling-side tuning (this is the visualization signal
     * only, unaffected by that).
     */
    public double proximityToNumber(Boolean inPerson) {
        if (inPerson == null) return 0.5;
        return inPerson ? 1.0 : 0.0;
    }
}
