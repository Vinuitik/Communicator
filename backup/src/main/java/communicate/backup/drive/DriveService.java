package communicate.backup.drive;

import com.google.api.client.googleapis.json.GoogleJsonResponseException;
import com.google.api.client.googleapis.javanet.GoogleNetHttpTransport;
import com.google.api.client.http.ByteArrayContent;
import com.google.api.client.json.gson.GsonFactory;
import com.google.api.services.drive.Drive;
import com.google.api.services.drive.model.File;
import com.google.api.services.drive.model.FileList;
import com.google.auth.http.HttpCredentialsAdapter;
import com.google.auth.oauth2.UserCredentials;
import communicate.backup.settings.SettingsService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Google Drive client for encrypted backups, ported (and trimmed) from ObsidianOptimizer's
 * DriveService. Differences: OAuth-only (no service-account fallback), and a FLAT layout —
 * all backups live directly in one auto-created "Communicator" folder, distinguished by the
 * {@code kind} appProperty ("db" | "files"). No nested vault-path folders, no janitor.
 *
 * <p>Retry/backoff on transient Drive errors is kept verbatim from OO ({@link #withRetry}).
 */
@Service
public class DriveService {

    private static final Logger log = LoggerFactory.getLogger(DriveService.class);
    private static final String FOLDER_MIME = "application/vnd.google-apps.folder";

    /** Auto-created top-level backup folder in the owner's Drive. */
    private static final String ROOT_FOLDER_NAME = "Communicator";

    @Value("${backup.oauth.client-id:}")     private String clientId;
    @Value("${backup.oauth.client-secret:}") private String clientSecret;
    @Value("${backup.max-retries:5}")        private int maxRetries;

    private final SettingsService settings;

    // Built lazily so a connect via OAuth takes effect without a restart. reset() drops it.
    private volatile Drive drive;

    public DriveService(SettingsService settings) {
        this.settings = settings;
    }

    // ── Client lifecycle ────────────────────────────────────────────────────────

    private synchronized Drive ensureClient() {
        if (drive != null) return drive;
        try {
            String refreshToken = settings.getRefreshToken();
            if (refreshToken.isBlank() || clientId.isBlank() || clientSecret.isBlank()) return null;

            UserCredentials creds = UserCredentials.newBuilder()
                .setClientId(clientId)
                .setClientSecret(clientSecret)
                .setRefreshToken(refreshToken)
                .build();

            drive = new Drive.Builder(
                GoogleNetHttpTransport.newTrustedTransport(),
                GsonFactory.getDefaultInstance(),
                new HttpCredentialsAdapter(creds))
                .setApplicationName("Communicator-Backup")
                .build();
            log.info("[Drive] client initialised (oauth)");
            return drive;
        } catch (Exception e) {
            log.error("[Drive] client init failed: {}", e.getMessage());
            return null;
        }
    }

    /** Drop the client so the next call rebuilds from current settings. */
    public synchronized void reset() {
        drive = null;
    }

    /** Client id + secret present (env) — i.e. a connect flow is even possible. */
    public boolean isClientConfigured() {
        return !clientId.isBlank() && !clientSecret.isBlank();
    }

    /** A refresh token is stored — Drive is usable. */
    public boolean isConfigured() {
        return !settings.getRefreshToken().isBlank() && isClientConfigured();
    }

    private Drive requireClient() throws IOException {
        Drive d = ensureClient();
        if (d == null) throw new IOException("Google Drive not connected");
        return d;
    }

    public String fetchAccountEmail() throws IOException {
        return requireClient().about().get().setFields("user(emailAddress)")
            .execute().getUser().getEmailAddress();
    }

    /** {usedBytes, limitBytes} — limitBytes null means unlimited. */
    public Map<String, Long> fetchQuota() throws IOException {
        var q = requireClient().about().get().setFields("storageQuota").execute().getStorageQuota();
        Map<String, Long> out = new HashMap<>();
        out.put("usedBytes",  q.getUsage());
        out.put("limitBytes", q.getLimit());
        return out;
    }

    // ── Root folder (find-or-create, persisted) ───────────────────────────────────

    /**
     * The "Communicator" backup folder id. drive.file scope only sees app-created files,
     * so the by-name lookup can't collide with the user's own folders. Persisted so we
     * reuse the same folder every run.
     */
    private String rootFolderId() throws IOException {
        String configured = settings.getDriveFolderId();
        if (!configured.isBlank()) return configured;

        Drive d = requireClient();
        FileList found = d.files().list()
            .setQ("name = '" + ROOT_FOLDER_NAME + "' and mimeType = '" + FOLDER_MIME + "' and trashed = false")
            .setFields("files(id)").setPageSize(1).execute();
        String id;
        if (!found.getFiles().isEmpty()) {
            id = found.getFiles().get(0).getId();
        } else {
            File folder = new File().setName(ROOT_FOLDER_NAME).setMimeType(FOLDER_MIME);
            id = d.files().create(folder).setFields("id").execute().getId();
            log.info("[Drive] created backup folder '{}' ({})", ROOT_FOLDER_NAME, id);
        }
        settings.set(SettingsService.DRIVE_FOLDER_ID, id);
        return id;
    }

    // ── Upload / list / download / delete ─────────────────────────────────────────

    /** Upload an encrypted backup into the root folder. Returns the Drive file id. */
    public String uploadBackup(byte[] bytes, String name, String kind,
                               String pgVersion, String deviceId) throws IOException {
        String folderId = rootFolderId();
        Map<String, String> props = new HashMap<>();
        props.put("kind",       kind);
        props.put("created_at", String.valueOf(System.currentTimeMillis()));
        props.put("device_id",  deviceId == null ? "" : deviceId);
        if (pgVersion != null && !pgVersion.isBlank()) props.put("pg_version", pgVersion);

        File meta = new File()
            .setName(name)
            .setParents(Collections.singletonList(folderId))
            .setAppProperties(props);
        ByteArrayContent content = new ByteArrayContent("application/octet-stream", bytes);
        Drive d = requireClient();
        return withRetry(() -> d.files().create(meta, content).setFields("id").execute()).getId();
    }

    /** All backups of a given kind, newest first (by created_at appProperty, then name). */
    public List<BackupInfo> listBackups(String kind) throws IOException {
        List<BackupInfo> out = new ArrayList<>();
        String folderId = rootFolderId();
        String pageToken = null;
        do {
            Drive.Files.List req = requireClient().files().list()
                .setQ("'" + folderId + "' in parents and trashed = false")
                .setFields("nextPageToken, files(id, name, size, appProperties)")
                .setPageSize(1000);
            if (pageToken != null) req.setPageToken(pageToken);
            FileList page = req.execute();
            for (File f : page.getFiles()) {
                Map<String, String> props = f.getAppProperties();
                if (props == null || !kind.equals(props.get("kind"))) continue;
                out.add(new BackupInfo(f.getId(), f.getName(),
                    parseLong(props.getOrDefault("created_at", "0")),
                    f.getSize() == null ? 0L : f.getSize()));
            }
            pageToken = page.getNextPageToken();
        } while (pageToken != null);
        out.sort((a, b) -> {
            int c = Long.compare(b.createdAt(), a.createdAt());
            return c != 0 ? c : b.name().compareTo(a.name());
        });
        return out;
    }

    public Optional<BackupInfo> latestBackup(String kind) throws IOException {
        List<BackupInfo> all = listBackups(kind);
        return all.isEmpty() ? Optional.empty() : Optional.of(all.get(0));
    }

    public byte[] downloadFile(String fileId) throws IOException {
        return withRetry(() -> {
            ByteArrayOutputStream bos = new ByteArrayOutputStream();
            requireClient().files().get(fileId).executeMediaAndDownloadTo(bos);
            return bos.toByteArray();
        });
    }

    /** Hard-delete an old backup (rotation) — bypasses trash so retention frees quota. */
    public void deleteBackup(String fileId) throws IOException {
        try {
            requireClient().files().delete(fileId).execute();
        } catch (GoogleJsonResponseException e) {
            if (e.getStatusCode() != 404) throw e; // already gone = done
        }
    }

    public record BackupInfo(String fileId, String name, long createdAt, long sizeBytes) {}

    // ── Retry (verbatim from OO) ──────────────────────────────────────────────────

    private <T> T withRetry(DriveCall<T> call) throws IOException {
        int attempt = 0;
        while (true) {
            try {
                return call.run();
            } catch (GoogleJsonResponseException e) {
                String reason = reasonOf(e);
                if (!isTransient(e.getStatusCode(), reason) || ++attempt >= maxRetries) {
                    if (e.getStatusCode() == 403 || e.getStatusCode() == 429) {
                        log.warn("[Drive] giving up after {} attempt(s): {} reason='{}'",
                            attempt, e.getStatusCode(), reason);
                    }
                    throw e;
                }
                sleepBackoff(attempt);
            } catch (java.net.SocketTimeoutException | java.net.UnknownHostException e) {
                if (++attempt >= maxRetries) throw e;
                sleepBackoff(attempt);
            }
        }
    }

    private static String reasonOf(GoogleJsonResponseException e) {
        if (e.getDetails() != null && e.getDetails().getErrors() != null
                && !e.getDetails().getErrors().isEmpty()) {
            return String.valueOf(e.getDetails().getErrors().get(0).getReason());
        }
        return "";
    }

    static boolean isTransient(int statusCode, String reason) {
        if (statusCode == 429 || statusCode >= 500) return true;
        if (statusCode == 403) {
            if (reason == null || reason.isBlank()) return true;   // unlabelled burst 403 → back off
            return !(reason.contains("insufficientPermissions")
                  || reason.contains("insufficientFilePermissions")
                  || reason.contains("storageQuotaExceeded")
                  || reason.contains("appNotAuthorizedToFile")
                  || reason.contains("domainPolicy")
                  || reason.contains("sharingRateLimitExceeded"));
        }
        return false;
    }

    private static void sleepBackoff(int attempt) {
        long base = Math.min(8000L, 500L * (1L << (attempt - 1)));
        long delay = base + (long) (Math.random() * 250);
        try {
            Thread.sleep(delay);
        } catch (InterruptedException ie) {
            Thread.currentThread().interrupt();
        }
    }

    @FunctionalInterface
    private interface DriveCall<T> {
        T run() throws IOException;
    }

    private static long parseLong(String s) {
        try { return Long.parseLong(s); } catch (NumberFormatException e) { return 0L; }
    }
}
