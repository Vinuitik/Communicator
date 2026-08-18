package communicate.Friend.Config;

import java.util.Map;
import java.util.stream.Collectors;

import org.springframework.stereotype.Component;

import communicate.Friend.FriendEntities.SchedulingRolePreset;
import communicate.Friend.FriendRepositories.SchedulingRolePresetRepository;
import lombok.RequiredArgsConstructor;

/**
 * Role -> desiredRetention/maxIntervalDays preset lookup (design doc premise
 * 10, plus the max-interval cap fix). DB-backed ({@code scheduling_role_preset},
 * via {@link SchedulingRolePresetRepository}) instead of the old
 * {@code @ConfigurationProperties} YAML binding — editable live from Settings
 * without a redeploy. Old {@code fsrs.role.desired-retention.*} YAML values
 * are now seed defaults only (see {@code SchedulingRolePresetSeedService}),
 * not the live read path.
 *
 * Reads go through a simple in-memory cache (whole table, loaded lazily) so
 * every scheduling decision doesn't hit the DB — {@link #invalidateCache()}
 * is called by whatever writes a preset (the settings controller) so the
 * very next read picks up the change, no restart needed.
 */
@Component
@RequiredArgsConstructor
public class RoleProperties {

    /** Fallback for an unknown/missing role — matches the old top-level fsrs.desired-retention default. */
    static final double FALLBACK_DESIRED_RETENTION = 0.9;

    /**
     * Fallback max-interval cap for an unknown/missing role. There was no
     * YAML equivalent (this cap is new — the bug being fixed), so this picks
     * the least restrictive of the seeded starter presets (Casual/Family,
     * 365d) rather than an arbitrary number: an unrecognised role still gets
     * SOME ceiling (never unbounded), but isn't clamped tighter than the
     * loosest known role.
     */
    static final int FALLBACK_MAX_INTERVAL_DAYS = 365;

    private final SchedulingRolePresetRepository repository;

    private volatile Map<String, SchedulingRolePreset> cache;

    public double getDesiredRetention(String friendRole) {
        SchedulingRolePreset preset = lookup(friendRole);
        return preset != null ? preset.getDesiredRetention() : FALLBACK_DESIRED_RETENTION;
    }

    public int getMaxIntervalDays(String friendRole) {
        SchedulingRolePreset preset = lookup(friendRole);
        return preset != null ? preset.getMaxIntervalDays() : FALLBACK_MAX_INTERVAL_DAYS;
    }

    /** Drop the cached table so the next read reloads from the DB. Call after any write. */
    public void invalidateCache() {
        cache = null;
    }

    private SchedulingRolePreset lookup(String friendRole) {
        if (friendRole == null) return null;
        return presets().get(friendRole);
    }

    private Map<String, SchedulingRolePreset> presets() {
        Map<String, SchedulingRolePreset> loaded = cache;
        if (loaded == null) {
            loaded = repository.findAll().stream()
                .collect(Collectors.toMap(SchedulingRolePreset::getRole, p -> p));
            cache = loaded;
        }
        return loaded;
    }
}
