package communicate.Friend.FriendControllers;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import communicate.Friend.Config.RoleProperties;
import communicate.Friend.FriendEntities.SchedulingRolePreset;
import communicate.Friend.FriendRepositories.SchedulingRolePresetRepository;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * A settings write (PUT /scheduling/roles/{role}) must take effect on the
 * very next scheduling call (RoleProperties.getMaxIntervalDays) without an
 * app restart -- i.e. the controller's write must invalidate RoleProperties'
 * cache. Both the controller and RoleProperties share the same (mocked)
 * repository here, exactly like they'd share the same DB row in production.
 */
class SchedulingRolePresetControllerTest {

    private final Map<String, SchedulingRolePreset> store = new HashMap<>();
    private SchedulingRolePresetRepository repository;
    private RoleProperties roleProperties;
    private SchedulingRolePresetController controller;

    @BeforeEach
    void setUp() {
        store.put("Partner", new SchedulingRolePreset("Partner", 0.95, 60));
        repository = mock(SchedulingRolePresetRepository.class);
        when(repository.findAll()).thenAnswer(inv -> new java.util.ArrayList<>(store.values()));
        when(repository.findById(anyString())).thenAnswer(inv -> Optional.ofNullable(store.get(inv.getArgument(0, String.class))));
        when(repository.save(any(SchedulingRolePreset.class))).thenAnswer(inv -> {
            SchedulingRolePreset p = inv.getArgument(0, SchedulingRolePreset.class);
            store.put(p.getRole(), p);
            return p;
        });
        roleProperties = new RoleProperties(repository);
        controller = new SchedulingRolePresetController(repository, roleProperties);
    }

    @Test
    void putNewMaxIntervalDays_takesEffectOnVeryNextSchedulingCall_noRestart() {
        // Warm the cache with the old value, as a real scheduling call would.
        assertThat(roleProperties.getMaxIntervalDays("Partner")).isEqualTo(60);

        controller.update("Partner", new SchedulingRolePreset("Partner", 0.95, 21));

        assertThat(roleProperties.getMaxIntervalDays("Partner")).isEqualTo(21);
    }

    @Test
    void getAll_reflectsStoredPresets() {
        assertThat(controller.getAll()).extracting(SchedulingRolePreset::getRole).containsExactly("Partner");
    }
}
