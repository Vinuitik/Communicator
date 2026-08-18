package communicate.Friend.FriendService;

import java.util.LinkedHashMap;
import java.util.Map;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import communicate.Friend.FriendEntities.SchedulingRolePreset;
import communicate.Friend.FriendRepositories.SchedulingRolePresetRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Seeds the starter Partner/Close/Casual/Family {@code scheduling_role_preset}
 * rows (desiredRetention copied from the old `fsrs.role.desired-retention.*`
 * YAML defaults; maxIntervalDays is new — the fix for FSRS scheduling
 * someone 200+ days out with no ceiling). Idempotent and cheap to re-run
 * (skips any role whose row already exists) so it's driven by a startup
 * runner ({@link SchedulingRolePresetSeedRunner}) rather than a one-shot
 * migration flag — same boot-time-reconciliation convention as
 * {@link FsrsBackfillService}/{@link FsrsBackfillRunner}. Never overwrites
 * an already-edited value: this only INSERTs missing rows, it never UPDATEs
 * an existing one.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class SchedulingRolePresetSeedService {

    /** Starter presets (rough, meant to be retuned later — design doc Open Questions). */
    private static final Map<String, SchedulingRolePreset> DEFAULTS = defaults();

    private final SchedulingRolePresetRepository repository;

    @Transactional
    public int seedDefaults() {
        int seeded = 0;
        for (SchedulingRolePreset preset : DEFAULTS.values()) {
            if (repository.existsById(preset.getRole())) continue; // already exists — never overwrite an edited value
            repository.save(new SchedulingRolePreset(preset.getRole(), preset.getDesiredRetention(), preset.getMaxIntervalDays()));
            seeded++;
        }
        if (seeded > 0) {
            log.info("[scheduling role preset seed] seeded {} default role preset(s)", seeded);
        }
        return seeded;
    }

    private static Map<String, SchedulingRolePreset> defaults() {
        Map<String, SchedulingRolePreset> presets = new LinkedHashMap<>();
        // desiredRetention values match bootstrap/src/main/resources/application.yml's
        // old fsrs.role.desired-retention.* (now seed-only, not the live read path).
        presets.put("Partner", new SchedulingRolePreset("Partner", 0.95, 60));
        presets.put("Close", new SchedulingRolePreset("Close", 0.9, 180));
        presets.put("Casual", new SchedulingRolePreset("Casual", 0.8, 365));
        presets.put("Family", new SchedulingRolePreset("Family", 0.85, 365));
        return presets;
    }
}
