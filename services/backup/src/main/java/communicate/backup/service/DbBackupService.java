package communicate.backup.service;

import communicate.backup.crypto.EncryptionService;
import communicate.backup.drive.DriveService;
import communicate.backup.drive.DriveService.BackupInfo;
import communicate.backup.settings.SettingsService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Optional;

/**
 * Backs up the whole Postgres database (all services share {@code my_database}) as an
 * encrypted {@code pg_dump -Fc}, and restores it via {@code pg_restore}. Ported from OO's
 * DbBackupService; the pg client is baked into the runtime image (see Dockerfile).
 */
@Service
public class DbBackupService {

    private static final Logger log = LoggerFactory.getLogger(DbBackupService.class);
    private static final DateTimeFormatter TS =
        DateTimeFormatter.ofPattern("yyyyMMdd-HHmmss").withZone(ZoneOffset.UTC);
    public static final String KIND = "db";

    private final DriveService driveService;
    private final EncryptionService encryptionService;
    private final SettingsService settings;
    private final JdbcTemplate jdbc;

    @Value("${spring.datasource.url}")      private String jdbcUrl;
    @Value("${spring.datasource.username}") private String dbUser;
    @Value("${spring.datasource.password}") private String dbPassword;
    @Value("${backup.keep:3}")              private int keep;

    public DbBackupService(DriveService driveService, EncryptionService encryptionService,
                           SettingsService settings, JdbcTemplate jdbc) {
        this.driveService = driveService;
        this.encryptionService = encryptionService;
        this.settings = settings;
        this.jdbc = jdbc;
    }

    // ── Backup ────────────────────────────────────────────────────────────────────

    /** pg_dump -Fc → encrypt → upload → prune to `keep`. Throws so the orchestrator can report. */
    public void backupNow() {
        if (!encryptionService.isConfigured()) throw new IllegalStateException("Encryption passphrase not set");
        if (!driveService.isConfigured())      throw new IllegalStateException("Google Drive not connected");

        Path tmp = null;
        try {
            tmp = Files.createTempFile("communicator-db", ".pgdump");
            Db db = parseJdbc(jdbcUrl);
            log.info("[DbBackup] pg_dump starting ({}:{}/{})", db.host, db.port, db.name);
            runPg(List.of("pg_dump", "-Fc", "-h", db.host, "-p", db.port,
                          "-U", dbUser, "-d", db.name, "-f", tmp.toString()), "pg_dump");

            byte[] enc = encryptionService.encrypt(Files.readAllBytes(tmp));
            String name = "communicator-db-" + TS.format(ZonedDateTime.now(ZoneOffset.UTC)) + ".pgdump.enc";
            String id = driveService.uploadBackup(enc, name, KIND, serverVersion(), settings.getOrCreateDeviceId());
            log.info("[DbBackup] uploaded {} ({} bytes encrypted, driveId={})", name, enc.length, id);

            prune();
        } catch (Exception e) {
            log.error("[DbBackup] backup failed: {}", e.getMessage());
            throw new RuntimeException("DB backup failed: " + e.getMessage(), e);
        } finally {
            deleteQuietly(tmp);
        }
    }

    private void prune() throws IOException {
        List<BackupInfo> all = driveService.listBackups(KIND); // newest first
        for (int i = keep; i < all.size(); i++) {
            try {
                driveService.deleteBackup(all.get(i).fileId());
                log.info("[DbBackup] pruned old dump {}", all.get(i).name());
            } catch (Exception e) {
                log.warn("[DbBackup] prune failed for {}: {}", all.get(i).name(), e.getMessage());
            }
        }
    }

    // ── Restore ─────────────────────────────────────────────────────────────────

    /** Download latest dump → decrypt → pg_restore. Destructive; guarded to an empty DB unless force. */
    public void restore(boolean force) {
        String blocked = restoreBlockedReason(force);
        if (blocked != null) throw new IllegalStateException(blocked);

        Path tmp = null;
        try {
            BackupInfo backup = driveService.latestBackup(KIND).orElseThrow();
            byte[] enc = driveService.downloadFile(backup.fileId());
            byte[] dump = encryptionService.decrypt(enc);
            tmp = Files.createTempFile("communicator-restore", ".pgdump");
            Files.write(tmp, dump);
            log.info("[DbBackup] restoring from {} ({} bytes)", backup.name(), dump.length);

            Db db = parseJdbc(jdbcUrl);
            runPg(List.of("pg_restore", "--clean", "--if-exists", "--no-owner",
                          "-h", db.host, "-p", db.port, "-U", dbUser, "-d", db.name,
                          tmp.toString()), "pg_restore");
            log.info("[DbBackup] DB restore complete — a restart of the app services is recommended.");
        } catch (Exception e) {
            log.error("[DbBackup] restore failed: {}", e.getMessage());
            throw new RuntimeException("DB restore failed: " + e.getMessage(), e);
        } finally {
            deleteQuietly(tmp);
        }
    }

    /** Null if a restore may proceed, else a human-readable reason (for a synchronous 400). */
    public String restoreBlockedReason(boolean force) {
        if (!encryptionService.isConfigured()) return "Encryption passphrase not set";
        if (!driveService.isConfigured())      return "Google Drive not connected";
        if (!force && !isDbEmpty())            return "Database is not empty — confirm with force=true to overwrite";
        try {
            if (driveService.latestBackup(KIND).isEmpty()) return "No DB backup found in Drive";
        } catch (Exception e) {
            return "Could not reach Drive: " + e.getMessage();
        }
        return null;
    }

    // ── Status helpers ────────────────────────────────────────────────────────────

    public boolean isDbEmpty() {
        try {
            Integer n = jdbc.queryForObject("SELECT COUNT(*) FROM friend", Integer.class);
            return n == null || n == 0;
        } catch (Exception e) {
            return true; // table absent → fresh DB
        }
    }

    public Optional<BackupInfo> latest() {
        try { return driveService.latestBackup(KIND); } catch (Exception e) { return Optional.empty(); }
    }

    public int count() {
        try { return driveService.listBackups(KIND).size(); } catch (Exception e) { return 0; }
    }

    // ── pg helpers (from OO) ──────────────────────────────────────────────────────

    private String serverVersion() {
        try { return jdbc.queryForObject("SHOW server_version", String.class); }
        catch (Exception e) { return ""; }
    }

    private void runPg(List<String> cmd, String label) throws IOException, InterruptedException {
        ProcessBuilder pb = new ProcessBuilder(cmd);
        pb.environment().put("PGPASSWORD", dbPassword);
        pb.redirectErrorStream(true);
        Process p = pb.start();
        String out = new String(p.getInputStream().readAllBytes());
        int code = p.waitFor();
        if (code != 0) {
            throw new IOException(label + " exited " + code + ": " + out.strip());
        }
        if (!out.isBlank()) log.info("[DbBackup] {} output: {}", label, out.strip());
    }

    /** jdbc:postgresql://host:port/db?params → (host, port, db). */
    static Db parseJdbc(String url) {
        String s = url.replaceFirst("^jdbc:postgresql://", "");
        int q = s.indexOf('?');
        if (q >= 0) s = s.substring(0, q);
        int slash = s.indexOf('/');
        String hostPort = slash >= 0 ? s.substring(0, slash) : s;
        String name     = slash >= 0 ? s.substring(slash + 1) : "postgres";
        int colon = hostPort.indexOf(':');
        String host = colon >= 0 ? hostPort.substring(0, colon) : hostPort;
        String port = colon >= 0 ? hostPort.substring(colon + 1) : "5432";
        return new Db(host, port, name);
    }

    record Db(String host, String port, String name) {}

    private static void deleteQuietly(Path p) {
        if (p == null) return;
        try { Files.deleteIfExists(p); } catch (IOException ignored) {}
    }
}
