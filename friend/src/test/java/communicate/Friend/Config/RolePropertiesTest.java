package communicate.Friend.Config;

import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class RolePropertiesTest {

    @Test
    void noRoleConfigBound_alwaysReturnsFallback() {
        RoleProperties properties = new RoleProperties();
        properties.setDesiredRetention(0.9);

        assertThat(properties.getDesiredRetention("Partner")).isEqualTo(0.9);
        assertThat(properties.getDesiredRetention(null)).isEqualTo(0.9);
    }

    @Test
    void knownRole_resolvesToItsPreset() {
        RoleProperties properties = new RoleProperties();
        properties.setDesiredRetention(0.9);
        RoleProperties.Role role = new RoleProperties.Role();
        role.setDesiredRetention(Map.of("Partner", 0.95, "Casual", 0.8));
        properties.setRole(role);

        assertThat(properties.getDesiredRetention("Partner")).isEqualTo(0.95);
        assertThat(properties.getDesiredRetention("Casual")).isEqualTo(0.8);
    }

    @Test
    void unknownRole_fallsBackToTopLevelDefault() {
        RoleProperties properties = new RoleProperties();
        properties.setDesiredRetention(0.9);
        RoleProperties.Role role = new RoleProperties.Role();
        role.setDesiredRetention(Map.of("Partner", 0.95));
        properties.setRole(role);

        assertThat(properties.getDesiredRetention("SomeUnconfiguredRole")).isEqualTo(0.9);
        assertThat(properties.getDesiredRetention(null)).isEqualTo(0.9);
    }
}
