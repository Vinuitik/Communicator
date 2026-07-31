package communicate.Friend.Config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.util.Map;

/**
 * Role -> desiredRetention preset lookup (design doc premise 10). Free-form
 * map rather than an enum so new roles can be added in application.yml
 * without a code change. Starter presets (Partner/Close/Casual/Family) are
 * guesses per the design doc's Open Questions — retune with real usage.
 */
@Data
@Component
@ConfigurationProperties(prefix = "fsrs")
public class RoleProperties {

    private double desiredRetention = 0.9; // fallback for an unknown/missing role
    private Role role;

    @Data
    public static class Role {
        private Map<String, Double> desiredRetention;
    }

    public double getDesiredRetention(String friendRole) {
        if (role == null || role.getDesiredRetention() == null || friendRole == null) {
            return desiredRetention;
        }
        return role.getDesiredRetention().getOrDefault(friendRole, desiredRetention);
    }
}
