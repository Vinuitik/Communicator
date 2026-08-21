package communicate.Friend.FriendControllers;

import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RestController;

import communicate.Friend.Config.RoleProperties;
import communicate.Friend.FriendEntities.SchedulingRolePreset;
import communicate.Friend.FriendRepositories.SchedulingRolePresetRepository;
import lombok.RequiredArgsConstructor;

/**
 * Live-editable per-role FSRS scheduling presets (desiredRetention +
 * maxIntervalDays) — settings UI precedent, see SettingsPage.tsx's
 * "Scheduling" section. No auth, same as every other friend/** endpoint —
 * see PROTO.md's "No auth" note.
 */
@RestController
@RequiredArgsConstructor
@RequestMapping("/scheduling/roles")
@CrossOrigin(origins = "http://nginx", allowedHeaders = "*", methods = {RequestMethod.GET, RequestMethod.PUT})
public class SchedulingRolePresetController {

    private final SchedulingRolePresetRepository repository;
    private final RoleProperties roleProperties;

    @GetMapping
    public List<SchedulingRolePreset> getAll() {
        return repository.findAll();
    }

    /**
     * Upsert one role's preset. Invalidates RoleProperties' cache so the very
     * next scheduling decision (ReviewService.reviewInteraction) sees the new
     * value without an app restart.
     */
    @PutMapping("/{role}")
    public ResponseEntity<SchedulingRolePreset> update(@PathVariable String role, @RequestBody SchedulingRolePreset payload) {
        SchedulingRolePreset preset = repository.findById(role)
            .orElseGet(() -> new SchedulingRolePreset(role, payload.getDesiredRetention(), payload.getMaxIntervalDays()));
        preset.setRole(role);
        preset.setDesiredRetention(payload.getDesiredRetention());
        preset.setMaxIntervalDays(payload.getMaxIntervalDays());
        repository.save(preset);
        roleProperties.invalidateCache();
        return ResponseEntity.ok(preset);
    }
}
