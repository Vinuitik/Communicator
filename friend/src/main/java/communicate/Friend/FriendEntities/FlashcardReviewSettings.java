package communicate.Friend.FriendEntities;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Global scalar settings for the flashcard-review daily cap / lapse jobs —
 * ported design (not necessarily numbers) from ObsidianOptimizer's
 * SpreadService/BankruptcyService (see FlashcardSpreadService/
 * FlashcardBankruptcyService). Three global values, so a single-row
 * singleton entity (id always {@link #SINGLETON_ID}) is simpler here than
 * a generic key-value settings table (that pattern — backup's
 * SettingsService — is scoped to a different module and per-key, not a
 * better fit for three fixed scalars). Same DB-backed, live-editable
 * philosophy as SchedulingRolePreset.
 */
@Entity
@Table(name = "flashcard_review_settings")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class FlashcardReviewSettings {

    public static final Integer SINGLETON_ID = 1;

    @Id
    private Integer id;

    /** OO's SpreadService default. */
    private int maxDailyReviews;

    /** OO's BankruptcyService pass-1 default. */
    private int chronicNeglectDays;

    /** OO's BankruptcyService pass-2 default. */
    private int bankruptcyLimit;
}
