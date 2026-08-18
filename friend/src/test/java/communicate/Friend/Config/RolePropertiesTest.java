package communicate.Friend.Config;

import java.util.List;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import communicate.Friend.FriendEntities.SchedulingRolePreset;
import communicate.Friend.FriendRepositories.SchedulingRolePresetRepository;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RolePropertiesTest {

    @Mock SchedulingRolePresetRepository repository;

    @Test
    void noRowsInDb_alwaysReturnsFallback() {
        when(repository.findAll()).thenReturn(List.of());
        RoleProperties properties = new RoleProperties(repository);

        assertThat(properties.getDesiredRetention("Partner")).isEqualTo(RoleProperties.FALLBACK_DESIRED_RETENTION);
        assertThat(properties.getDesiredRetention(null)).isEqualTo(RoleProperties.FALLBACK_DESIRED_RETENTION);
        assertThat(properties.getMaxIntervalDays("Partner")).isEqualTo(RoleProperties.FALLBACK_MAX_INTERVAL_DAYS);
        assertThat(properties.getMaxIntervalDays(null)).isEqualTo(RoleProperties.FALLBACK_MAX_INTERVAL_DAYS);
    }

    @Test
    void knownRole_resolvesToItsPreset() {
        when(repository.findAll()).thenReturn(List.of(
            new SchedulingRolePreset("Partner", 0.95, 60),
            new SchedulingRolePreset("Casual", 0.8, 365)));
        RoleProperties properties = new RoleProperties(repository);

        assertThat(properties.getDesiredRetention("Partner")).isEqualTo(0.95);
        assertThat(properties.getMaxIntervalDays("Partner")).isEqualTo(60);
        assertThat(properties.getDesiredRetention("Casual")).isEqualTo(0.8);
        assertThat(properties.getMaxIntervalDays("Casual")).isEqualTo(365);
    }

    @Test
    void unknownRole_fallsBackToDefaults() {
        when(repository.findAll()).thenReturn(List.of(new SchedulingRolePreset("Partner", 0.95, 60)));
        RoleProperties properties = new RoleProperties(repository);

        assertThat(properties.getDesiredRetention("SomeUnconfiguredRole")).isEqualTo(RoleProperties.FALLBACK_DESIRED_RETENTION);
        assertThat(properties.getMaxIntervalDays("SomeUnconfiguredRole")).isEqualTo(RoleProperties.FALLBACK_MAX_INTERVAL_DAYS);
    }

    @Test
    void resultsAreCached_repositoryHitOnceAcrossMultipleReads() {
        when(repository.findAll()).thenReturn(List.of(new SchedulingRolePreset("Partner", 0.95, 60)));
        RoleProperties properties = new RoleProperties(repository);

        properties.getDesiredRetention("Partner");
        properties.getMaxIntervalDays("Partner");
        properties.getDesiredRetention("Partner");

        verify(repository, times(1)).findAll();
    }

    @Test
    void invalidateCache_forcesReloadOnNextRead() {
        when(repository.findAll())
            .thenReturn(List.of(new SchedulingRolePreset("Partner", 0.95, 60)))
            .thenReturn(List.of(new SchedulingRolePreset("Partner", 0.95, 30)));
        RoleProperties properties = new RoleProperties(repository);

        assertThat(properties.getMaxIntervalDays("Partner")).isEqualTo(60);

        properties.invalidateCache();

        assertThat(properties.getMaxIntervalDays("Partner")).isEqualTo(30);
        verify(repository, times(2)).findAll();
    }
}
