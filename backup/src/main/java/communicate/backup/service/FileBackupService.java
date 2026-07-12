package communicate.backup.service;

import communicate.backup.crypto.EncryptionService;
import communicate.backup.drive.DriveService;
import communicate.backup.drive.DriveService.BackupInfo;
import communicate.backup.settings.SettingsService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Optional;

/**
 * Backs up all media (photos / videos / voice / personal / group / connection resources) by
 * pulling a single zip from the fileRepository ({@code GET /backup}), encrypting it, and
 * uploading to Drive. Restore reverses it: decrypt the latest zip and POST it to the
 * fileRepository's {@code POST /restore}, which unpacks it back into the volumes.
 */
@Service
public class FileBackupService {

    private static final Logger log = LoggerFactory.getLogger(FileBackupService.class);
    private static final DateTimeFormatter TS =
        DateTimeFormatter.ofPattern("yyyyMMdd-HHmmss").withZone(ZoneOffset.UTC);
    public static final String KIND = "files";

    private final DriveService driveService;
    private final EncryptionService encryptionService;
    private final SettingsService settings;

    @Value("${backup.file-repository-url:http://fileRepository:5000}") private String fileRepoUrl;
    @Value("${backup.keep:3}") private int keep;

    private final HttpClient http = HttpClient.newBuilder()
        .connectTimeout(Duration.ofSeconds(30))
        .build();

    public FileBackupService(DriveService driveService, EncryptionService encryptionService,
                             SettingsService settings) {
        this.driveService = driveService;
        this.encryptionService = encryptionService;
        this.settings = settings;
    }

    // ── Backup ────────────────────────────────────────────────────────────────────

    /** GET the media zip → encrypt → upload → prune. No files ⇒ skipped (not an error). */
    public void backupNow() {
        if (!encryptionService.isConfigured()) throw new IllegalStateException("Encryption passphrase not set");
        if (!driveService.isConfigured())      throw new IllegalStateException("Google Drive not connected");

        try {
            HttpResponse<byte[]> resp = http.send(
                HttpRequest.newBuilder(URI.create(fileRepoUrl + "/backup"))
                    .timeout(Duration.ofMinutes(10)).GET().build(),
                HttpResponse.BodyHandlers.ofByteArray());

            String contentType = resp.headers().firstValue("content-type").orElse("");
            if (resp.statusCode() != 200 || !contentType.contains("application/zip")) {
                // fileRepository returns JSON "No files found to back up" (200) when empty.
                log.info("[FileBackup] nothing to back up (status={}, type={})", resp.statusCode(), contentType);
                return;
            }

            byte[] enc = encryptionService.encrypt(resp.body());
            String name = "communicator-files-" + TS.format(ZonedDateTime.now(ZoneOffset.UTC)) + ".zip.enc";
            String id = driveService.uploadBackup(enc, name, KIND, null, settings.getOrCreateDeviceId());
            log.info("[FileBackup] uploaded {} ({} bytes encrypted, driveId={})", name, enc.length, id);

            prune();
        } catch (Exception e) {
            log.error("[FileBackup] backup failed: {}", e.getMessage());
            throw new RuntimeException("File backup failed: " + e.getMessage(), e);
        }
    }

    private void prune() throws IOException {
        List<BackupInfo> all = driveService.listBackups(KIND);
        for (int i = keep; i < all.size(); i++) {
            try {
                driveService.deleteBackup(all.get(i).fileId());
                log.info("[FileBackup] pruned old zip {}", all.get(i).name());
            } catch (Exception e) {
                log.warn("[FileBackup] prune failed for {}: {}", all.get(i).name(), e.getMessage());
            }
        }
    }

    // ── Restore ─────────────────────────────────────────────────────────────────

    /** Download latest media zip → decrypt → POST to fileRepository /restore (unzips into volumes). */
    public void restore() {
        if (!encryptionService.isConfigured()) throw new IllegalStateException("Encryption passphrase not set");
        if (!driveService.isConfigured())      throw new IllegalStateException("Google Drive not connected");

        try {
            BackupInfo backup = driveService.latestBackup(KIND)
                .orElseThrow(() -> new IllegalStateException("No file backup found in Drive"));
            byte[] enc = driveService.downloadFile(backup.fileId());
            byte[] zip = encryptionService.decrypt(enc);
            log.info("[FileBackup] restoring {} ({} bytes) → fileRepository", backup.name(), zip.length);

            HttpResponse<String> resp = http.send(
                HttpRequest.newBuilder(URI.create(fileRepoUrl + "/restore"))
                    .timeout(Duration.ofMinutes(10))
                    .header("Content-Type", "application/zip")
                    .POST(HttpRequest.BodyPublishers.ofByteArray(zip)).build(),
                HttpResponse.BodyHandlers.ofString());

            if (resp.statusCode() / 100 != 2) {
                throw new IOException("fileRepository /restore returned " + resp.statusCode() + ": " + resp.body());
            }
            log.info("[FileBackup] file restore complete: {}", resp.body());
        } catch (Exception e) {
            log.error("[FileBackup] restore failed: {}", e.getMessage());
            throw new RuntimeException("File restore failed: " + e.getMessage(), e);
        }
    }

    // ── Status helpers ────────────────────────────────────────────────────────────

    public Optional<BackupInfo> latest() {
        try { return driveService.latestBackup(KIND); } catch (Exception e) { return Optional.empty(); }
    }

    public int count() {
        try { return driveService.listBackups(KIND).size(); } catch (Exception e) { return 0; }
    }
}
