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
}
