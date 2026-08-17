package communicate.backup.web;

import communicate.backup.crypto.EncryptionService;
import communicate.backup.drive.BackupOAuthService;
import communicate.backup.drive.DriveService;
import communicate.backup.service.BackupService;
import communicate.backup.service.DbBackupService;
import communicate.backup.settings.SettingsService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * REST surface for the backup service, reached at {@code /backup/**} through nginx.
 *
 * <p>Connect flow (one-time): open {@code GET /backup/oauth/url} in a browser → it 302s to
 * Google consent → Google 302s back to {@code /backup/oauth/callback} → the refresh token is
 * stored. After that, backups run on the nightly cron and via {@code POST /backup/run}.
 */
@RestController
@RequestMapping("/backup")
public class BackupController {

    private final BackupOAuthService oauth;
    private final DriveService drive;
    private final BackupService backup;
    private final DbBackupService dbBackup;
    private final SettingsService settings;
    private final EncryptionService encryption;

    public BackupController(BackupOAuthService oauth, DriveService drive, BackupService backup,
                            DbBackupService dbBackup, SettingsService settings, EncryptionService encryption) {
        this.oauth = oauth;
        this.drive = drive;
        this.backup = backup;
        this.dbBackup = dbBackup;
        this.settings = settings;
        this.encryption = encryption;
    }

    // ── OAuth connect ──────────────────────────────────────────────────────────────

    /** 302 to Google consent. Open this in a browser to connect the owner's Drive. */
    @GetMapping("/oauth/url")
    public ResponseEntity<?> oauthUrl(@RequestParam(defaultValue = "false") boolean json) {
        String url = oauth.buildAuthUrl();
        if (json) return ResponseEntity.ok(Map.of("url", url));
        return ResponseEntity.status(HttpStatus.FOUND).location(URI.create(url)).build();
    }

    /** Google redirects here with ?code&state. Redirects back into the app's Settings
     * page (not a standalone dead-end page) with a query param the frontend reads to
     * show a success/error toast — see SettingsPage.tsx. */
    @GetMapping(value = "/oauth/callback")
    public ResponseEntity<Void> oauthCallback(@RequestParam(required = false) String code,
                                              @RequestParam(required = false) String state,
                                              @RequestParam(required = false) String error) {
        if (error != null) return redirectToSettings("error", error);
        try {
            oauth.handleCallback(code, state);
            return redirectToSettings("connected", null);
        } catch (Exception e) {
            return redirectToSettings("error", e.getMessage());
        }
    }

    private ResponseEntity<Void> redirectToSettings(String drive, String message) {
        String location = "/app/settings?drive=" + drive
            + (message == null ? "" : "&message=" + java.net.URLEncoder.encode(message, java.nio.charset.StandardCharsets.UTF_8));
        return ResponseEntity.status(HttpStatus.FOUND).location(URI.create(location)).build();
    }

    @PostMapping("/disconnect")
    public ResponseEntity<?> disconnect() {
        oauth.disconnect();
        return ResponseEntity.ok(Map.of("connected", false));
    }

    // ── Status ──────────────────────────────────────────────────────────────────

    @GetMapping("/status")
    public ResponseEntity<?> status() {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("clientConfigured", oauth.isClientConfigured());
        m.put("connected", oauth.isConnected());
        m.put("accountEmail", settings.getAccountEmail());
        m.put("enabled", settings.isEnabled());
        m.putAll(backup.statusFragment());
        if (drive.isConfigured()) {
            try { m.put("quota", drive.fetchQuota()); } catch (Exception e) { m.put("quotaError", e.getMessage()); }
        }
        return ResponseEntity.ok(m);
    }

    // ── Backup / restore ──────────────────────────────────────────────────────────

    /** Trigger a full backup (DB + files). 202 if started, 409 if one is already running. */
    @PostMapping("/run")
    public ResponseEntity<?> run() {
        boolean started = backup.triggerBackup();
        return started
            ? ResponseEntity.accepted().body(Map.of("started", true))
            : ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("started", false, "reason", "already running"));
    }

    /** Restore DB (+ files). Destructive — pass force=true to overwrite a non-empty DB. */
    @PostMapping("/restore")
    public ResponseEntity<?> restore(@RequestParam(defaultValue = "false") boolean force) {
        String blocked = dbBackup.restoreBlockedReason(force);
        if (blocked != null) return ResponseEntity.badRequest().body(Map.of("started", false, "reason", blocked));
        boolean started = backup.triggerRestore(force);
        return started
            ? ResponseEntity.accepted().body(Map.of("started", true))
            : ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("started", false, "reason", "already running"));
    }

    /** Enable/disable the nightly auto-backup cron. */
    @PostMapping("/enabled")
    public ResponseEntity<?> setEnabled(@RequestParam boolean value) {
        settings.setEnabled(value);
        return ResponseEntity.ok(Map.of("enabled", value));
    }

    // ── Offline-outbox Drive relay bridge ──────────────────────────────────────────

    /**
     * Bridge bundle for the offline-outbox's Drive relay tier (react/src/pwa/driveClient.ts).
     * Mints a fresh short-lived Drive access token from the stored refresh token (never
     * exposes the refresh token or client secret itself) and hands back the shared
     * encryption key + mailbox folder id. Cached client-side with a safety margin against
     * expiresAt; the browser never calls Google's OAuth token endpoint directly.
     *
     * <p>409 if Drive isn't connected or the encryption passphrase isn't configured — a
     * client should never cache an unusable bridge (mirrors ObsidianOptimizer's
     * PwaController.setup() gating).
     */
    @GetMapping("/sync/bridge")
    public ResponseEntity<?> syncBridge() {
        if (!oauth.isConnected()) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("error", "Drive not connected"));
        }
        if (!encryption.isConfigured()) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("error", "Encryption not configured"));
        }
        try {
            DriveService.AccessTokenInfo token = drive.mintAccessToken();
            String mailboxFolderId = drive.mailboxFolderId();
            Map<String, Object> body = new LinkedHashMap<>();
            body.put("accessToken", token.accessToken());
            body.put("expiresAt", token.expiresAtEpochMillis());
            body.put("mailboxFolderId", mailboxFolderId);
            body.put("encryptionKeyBase64", encryption.exportKeyBase64());
            return ResponseEntity.ok(body);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", e.getMessage()));
        }
    }

}
