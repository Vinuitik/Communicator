package communicate.Friend.FriendService;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

import communicate.Friend.FriendEntities.SchedulingRolePreset;
import communicate.Friend.FriendRepositories.SchedulingRolePresetRepository;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Seed idempotency: running seedDefaults() twice must not change row count
 * nor reset an already-edited value back to the default -- it only INSERTs
 * missing rows, never UPDATEs an existing one.
 */
class SchedulingRolePresetSeedServiceTest {

    private final Map<String, SchedulingRolePreset> store = new HashMap<>();
    private SchedulingRolePresetRepository repository;
    private SchedulingRolePresetSeedService seedService;

    @BeforeEach
    void setUp() {
        store.clear();
        repository = mock(SchedulingRolePresetRepository.class);
        when(repository.existsById(org.mockito.ArgumentMatchers.anyString()))
            .thenAnswer(inv -> store.containsKey(inv.getArgument(0, String.class)));
        when(repository.findById(org.mockito.ArgumentMatchers.anyString()))
            .thenAnswer(inv -> Optional.ofNullable(store.get(inv.getArgument(0, String.class))));
        when(repository.save(org.mockito.ArgumentMatchers.any(SchedulingRolePreset.class)))
            .thenAnswer(inv -> {
                SchedulingRolePreset p = inv.getArgument(0, SchedulingRolePreset.class);
                store.put(p.getRole(), p);
                return p;
            });
        seedService = new SchedulingRolePresetSeedService(repository);
    }

    @Test
    void firstRun_insertsAllFourDefaultRoles() {
        int seeded = seedService.seedDefaults();

        assertThat(seeded).isEqualTo(4);
        assertThat(store).containsKeys("Partner", "Close", "Casual", "Family");
        assertThat(store.get("Partner").getMaxIntervalDays()).isEqualTo(60);
        assertThat(store.get("Close").getMaxIntervalDays()).isEqualTo(180);
        assertThat(store.get("Casual").getMaxIntervalDays()).isEqualTo(365);
        assertThat(store.get("Family").getMaxIntervalDays()).isEqualTo(365);
    }

    @Test
    void secondRun_rowCountUnchanged_noOverwrite() {
        seedService.seedDefaults();
        int seededAgain = seedService.seedDefaults();

        assertThat(seededAgain).isEqualTo(0);
        assertThat(store).hasSize(4);
    }

    @Test
    void alreadyEditedValue_isNotResetBackToDefault() {
        seedService.seedDefaults();
        // Simulate a user edit via the settings UI (a PUT that updates the existing row).
        store.get("Partner").setMaxIntervalDays(45);

        seedService.seedDefaults();

        assertThat(store.get("Partner").getMaxIntervalDays()).isEqualTo(45);
    }
}
