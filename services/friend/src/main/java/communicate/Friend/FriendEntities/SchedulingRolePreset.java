package communicate.Friend.FriendEntities;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Per-role FSRS scheduling preset: {@code desiredRetention} (design doc
 * premise 10) plus {@code maxIntervalDays}, the hard ceiling on how far out
 * FSRS+bandit is allowed to schedule someone (bug fix — stability compounds
 * with no ceiling otherwise, e.g. a few good chats in a row can push a
 * friend 200+ days out). DB-backed instead of YAML (`fsrs.role.*` in
 * application.yml) so it's editable live from Settings without a redeploy —
 * see {@code RoleProperties} for the read path and
 * {@code SchedulingRolePresetSeedService} for the one-time defaults seed.
 * Hibernate {@code ddl-auto: update} creates this table on next boot, same
 * as every other entity here (e.g. BanditArm) — no migration needed.
 */
@Entity
@Table(name = "scheduling_role_preset")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class SchedulingRolePreset {

    @Id
    private String role;

    private double desiredRetention;
    private int maxIntervalDays;
}
