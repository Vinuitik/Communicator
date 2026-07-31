package communicate.Friend.Config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.util.Map;

@Data
@Component
@ConfigurationProperties(prefix = "ema")
public class EmaProperties {
    
    private Coefficients coefficients;

    @Data
    public static class Coefficients {
        private Map<String, Double> newData;
        private Map<String, Double> decay;
    }

    /**
     * Get alpha coefficient for new data based on experience rating
     */
    public double getNewDataAlpha(String experience) {
        if (coefficients == null || coefficients.getNewData() == null) {
            return 0.7; // Default to good rating
        }

        return switch (experience) {
            case "***" -> coefficients.getNewData().getOrDefault("excellent", 0.6);
            case "**" -> coefficients.getNewData().getOrDefault("good", 0.7);
            case "*" -> coefficients.getNewData().getOrDefault("poor", 0.8);
            default -> coefficients.getNewData().getOrDefault("good", 0.7);
        };
    }

    /**
     * Get the nightly/no-interaction decay alpha based on a friend's last logged
     * experience rating. Single source for this value — used by the immediate
     * update path's future decay needs, ChronoJobService's nightly job, and the
     * timeline/series endpoint, replacing what used to be a second copy of this
     * same table under chrono.coefficients.decay.
     */
    public double getDecayAlpha(String lastExperience) {
        if (coefficients == null || coefficients.getDecay() == null) {
            return 0.2; // Default to good rating
        }

        return switch (lastExperience == null ? "good" : lastExperience) {
            case "***" -> coefficients.getDecay().getOrDefault("excellent", 0.07);
            case "**" -> coefficients.getDecay().getOrDefault("good", 0.2);
            case "*" -> coefficients.getDecay().getOrDefault("poor", 0.57);
            default -> coefficients.getDecay().getOrDefault("good", 0.2);
        };
    }
}
