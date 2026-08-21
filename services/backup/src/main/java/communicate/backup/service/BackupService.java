package communicate.backup.service;

import communicate.backup.drive.DriveService.BackupInfo;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.locks.ReentrantLock;

/**
 * Orchestrates DB + file backups/restores. Single-flight: a manual trigger never races the
 * nightly scheduler (both go through {@link #tryRun}). All work runs on a single background
 * thread so REST endpoints return immediately (202-style) and the caller polls {@code /status}.
 */
@Service
public class BackupService {

    private static final Logger log = LoggerFactory.getLogger(BackupService.class);

    private final DbBackupService dbBackup;
    private final FileBackupService fileBackup;

    private final ExecutorService worker = Executors.newSingleThreadExecutor(r -> {
        Thread t = new Thread(r, "backup-worker");
        t.setDaemon(true);
        return t;
    });
    private final ReentrantLock lock = new ReentrantLock();

    private volatile boolean running = false;
    private volatile String  phase   = "idle";
    private volatile String  lastResult = "";
    private volatile long    lastRunAt  = 0L;

    public BackupService(DbBackupService dbBackup, FileBackupService fileBackup) {
        this.dbBackup = dbBackup;
        this.fileBackup = fileBackup;
    }

    // ── Triggers ──────────────────────────────────────────────────────────────────

    /** Full backup (DB then files) on the worker thread. Returns false if one is already running. */
    public boolean triggerBackup() {
        return submit("backup", () -> {
            phase = "db backup";
            dbBackup.backupNow();
            phase = "file backup";
            fileBackup.backupNow();
        });
    }

    /** Restore DB then files. force overrides the not-empty guard on the DB restore. */
    public boolean triggerRestore(boolean force) {
        return submit("restore", () -> {
            phase = "db restore";
            dbBackup.restore(force);
            phase = "file restore";
            fileBackup.restore();
        });
    }

    /** Synchronous run for the scheduler (already off the request thread). */
    public void runScheduledBackup() {
        tryRun("scheduled backup", () -> {
            dbBackup.backupNow();
            fileBackup.backupNow();
        });
    }

    private boolean submit(String label, Runnable body) {
        if (running) return false;
        worker.submit(() -> tryRun(label, body));
        return true;
    }

    private void tryRun(String label, Runnable body) {
        if (!lock.tryLock()) {
            log.warn("[Backup] '{}' skipped — another operation is in progress", label);
            return;
        }
        running = true;
        lastRunAt = System.currentTimeMillis();
        try {
            log.info("[Backup] '{}' starting", label);
            body.run();
            lastResult = label + " ok";
            log.info("[Backup] '{}' done", label);
        } catch (Exception e) {
            lastResult = label + " failed: " + e.getMessage();
            log.error("[Backup] '{}' failed: {}", label, e.getMessage());
        } finally {
            running = false;
            phase = "idle";
            lock.unlock();
        }
    }

    public boolean isRunning() { return running; }

    // ── Status ──────────────────────────────────────────────────────────────────

    public Map<String, Object> statusFragment() {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("running", running);
        m.put("phase", phase);
        m.put("lastResult", lastResult);
        m.put("lastRunAt", lastRunAt);
        m.put("db", kindFragment(dbBackup.count(), dbBackup.latest()));
        m.put("files", kindFragment(fileBackup.count(), fileBackup.latest()));
        m.put("dbEmpty", dbBackup.isDbEmpty());
        return m;
    }

    private Map<String, Object> kindFragment(int count, Optional<BackupInfo> latest) {
        Map<String, Object> f = new LinkedHashMap<>();
        f.put("count", count);
        f.put("exists", latest.isPresent());
        latest.ifPresent(b -> {
            f.put("lastBackupAt", b.createdAt());
            f.put("sizeBytes", b.sizeBytes());
            f.put("name", b.name());
        });
        return f;
    }
}
