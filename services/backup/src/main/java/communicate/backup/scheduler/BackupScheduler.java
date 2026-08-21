package communicate.backup.scheduler;

import communicate.backup.service.BackupService;
import communicate.backup.settings.SettingsService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Nightly auto-backup. Cron from {@code backup.cron} (default 03:00 daily). Gated on the
 * {@code enabled} setting — the manual {@code POST /backup/run} works regardless.
 */
@Component
public class BackupScheduler {

    private static final Logger log = LoggerFactory.getLogger(BackupScheduler.class);

    private final BackupService backup;
    private final SettingsService settings;

    public BackupScheduler(BackupService backup, SettingsService settings) {
        this.backup = backup;
        this.settings = settings;
    }

    @Scheduled(cron = "${backup.cron:0 0 3 * * *}", zone = "UTC")
    public void scheduledBackup() {
        if (!settings.isEnabled()) {
            log.debug("[Scheduler] auto-backup disabled — skipping");
            return;
        }
        log.info("[Scheduler] nightly backup triggered");
        backup.runScheduledBackup();
    }
}
