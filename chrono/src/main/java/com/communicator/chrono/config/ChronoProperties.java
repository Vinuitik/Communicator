package com.communicator.chrono.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.util.Map;

@Data
@Component
@ConfigurationProperties(prefix = "chrono")
public class ChronoProperties {
    
    private Coefficients coefficients;
    private String schedule;
    private FriendService friendService;
    
    @Data
    public static class Coefficients {
        private Map<String, Double> decay;
    }
    
    @Data
    public static class FriendService {
        private String baseUrl;
        private int timeout;
        private int batchSize = 200; // Default batch size for interaction checks
        private int friendPageSize = 500; // Default page size for friend pagination
    }
    
    /**
     * Get alpha coefficient for decay based on last known experience
     */
    public double getDecayAlpha(String lastExperience) {
        if (coefficients == null || coefficients.getDecay() == null) {
            return 0.2; // Default to good rating
        }
        
        return switch (lastExperience) {
            case "***" -> coefficients.getDecay().getOrDefault("excellent", 0.07);
            case "**" -> coefficients.getDecay().getOrDefault("good", 0.2);
            case "*" -> coefficients.getDecay().getOrDefault("poor", 0.57);
            default -> coefficients.getDecay().getOrDefault("good", 0.2);
        };
    }
}
