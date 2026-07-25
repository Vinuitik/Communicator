package com.communicator.chrono.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.util.Map;

@Data
@Component
@ConfigurationProperties(prefix = "chrono")
public class ChronoProperties {

    // Rating keys as they appear under chrono.coefficients.decay in application.yml.
    private static final String RATING_EXCELLENT = "excellent"; // "***"
    private static final String RATING_GOOD = "good";           // "**"
    private static final String RATING_POOR = "poor";           // "*"

    // Fallbacks if application.yml doesn't set a value for that key.
    private static final double DEFAULT_DECAY_EXCELLENT = 0.07;
    private static final double DEFAULT_DECAY_GOOD = 0.2;
    private static final double DEFAULT_DECAY_POOR = 0.57;

    private Coefficients coefficients;
    private String schedule;
    private FriendService friendService;

    @Data
    public static class Coefficients {
        private Map<String, Double> decay;
    }

    @Data
    public static class FriendService {
        private int batchSize = 200; // Default batch size for interaction checks
        private int friendPageSize = 500; // Default page size for friend pagination
    }

    /**
     * Get the nightly decay alpha for a friend based on their last logged experience
     * rating — a friend whose last chat was "***" decays slower than one whose last
     * chat was "*". Unknown/null rating (shouldn't happen — Friend.experience is
     * @NotNull — but data can predate that constraint) falls back to RATING_GOOD.
     */
    public double getDecayAlpha(String lastExperience) {
        if (coefficients == null || coefficients.getDecay() == null) {
            return DEFAULT_DECAY_GOOD;
        }

        return switch (lastExperience == null ? RATING_GOOD : lastExperience) {
            case "***" -> coefficients.getDecay().getOrDefault(RATING_EXCELLENT, DEFAULT_DECAY_EXCELLENT);
            case "**" -> coefficients.getDecay().getOrDefault(RATING_GOOD, DEFAULT_DECAY_GOOD);
            case "*" -> coefficients.getDecay().getOrDefault(RATING_POOR, DEFAULT_DECAY_POOR);
            default -> coefficients.getDecay().getOrDefault(RATING_GOOD, DEFAULT_DECAY_GOOD);
        };
    }
}
