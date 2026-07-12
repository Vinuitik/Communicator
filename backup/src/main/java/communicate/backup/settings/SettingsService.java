package communicate.backup.settings;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

/**
 * Typed access to the {@code backup_settings} KV table. Mirrors the small slice of
 * OO's SettingsRepository the backup flow actually needs. Every getter returns "" for a
 * missing key so callers can {@code .isBlank()} without null checks.
 */
@Service
public class SettingsService {

    public static final String REFRESH_TOKEN   = "refresh_token";
    public static final String ACCOUNT_EMAIL   = "account_email";
    public static final String DRIVE_FOLDER_ID = "drive_folder_id";
    public static final String DEVICE_ID       = "device_id";
    public static final String ENABLED         = "enabled";

    private final BackupSettingRepository repo;

    public SettingsService(BackupSettingRepository repo) {
        this.repo = repo;
    }

    @Transactional(readOnly = true)
    public String get(String key) {
        return repo.findById(key).map(BackupSetting::getValue).map(v -> v == null ? "" : v).orElse("");
    }

    @Transactional
    public void set(String key, String value) {
        BackupSetting s = repo.findById(key).orElse(new BackupSetting(key, value));
        s.setValue(value);
        repo.save(s);
    }

    public String getRefreshToken() { return get(REFRESH_TOKEN); }
    public String getAccountEmail() { return get(ACCOUNT_EMAIL); }
    public String getDriveFolderId() { return get(DRIVE_FOLDER_ID); }

    /** Auto-backup is on by default (blank = enabled); only an explicit "false" disables it. */
    public boolean isEnabled() { return !"false".equalsIgnoreCase(get(ENABLED)); }
    public void setEnabled(boolean on) { set(ENABLED, String.valueOf(on)); }

    /** Stable per-install id stamped into every Drive backup's appProperties. */
    @Transactional
    public String getOrCreateDeviceId() {
        String id = get(DEVICE_ID);
        if (id.isBlank()) {
            id = UUID.randomUUID().toString().substring(0, 12);
            set(DEVICE_ID, id);
        }
        return id;
    }
}
