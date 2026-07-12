package communicate.backup.drive;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import communicate.backup.settings.SettingsService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.time.Duration;
import java.util.HexFormat;

/**
 * Google OAuth for the backup Drive — the one-time "Connect Google Drive" consent.
 * Ported from OO's SyncOAuthService, simplified for a single fixed local deployment:
 * client id/secret/redirect come from env, and the redirect URI is always the configured
 * one (no per-origin derivation). Scope is {@code drive.file} — the app only ever sees the
 * files it created. The resulting refresh token is stored in {@code backup_settings}.
 *
 * <p>Single-tenant ⇒ one in-flight consent at a time (the {@code pending} field).
 */
@Service
public class BackupOAuthService {

    private static final Logger log = LoggerFactory.getLogger(BackupOAuthService.class);

    private static final String AUTH_ENDPOINT   = "https://accounts.google.com/o/oauth2/v2/auth";
    private static final String TOKEN_ENDPOINT  = "https://oauth2.googleapis.com/token";
    private static final String REVOKE_ENDPOINT = "https://oauth2.googleapis.com/revoke";
    private static final String SCOPE           = "https://www.googleapis.com/auth/drive.file";
    private static final long   STATE_TTL_MS    = 10 * 60 * 1000;

    @Value("${backup.oauth.client-id:}")     private String clientId;
    @Value("${backup.oauth.client-secret:}") private String clientSecret;
    @Value("${backup.oauth.redirect-uri:}")  private String redirectUri;

    private record Pending(String state, long expiresAt) {}

    private final SettingsService settings;
    private final DriveService driveService;
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final HttpClient httpClient = HttpClient.newBuilder()
        .connectTimeout(Duration.ofSeconds(10))
        .build();

    private volatile Pending pending;

    public BackupOAuthService(SettingsService settings, DriveService driveService) {
        this.settings = settings;
        this.driveService = driveService;
    }

    public boolean isClientConfigured() {
        return !clientId.isBlank() && !clientSecret.isBlank();
    }

    public boolean isConnected() {
        return !settings.getRefreshToken().isBlank();
    }

    /** Build the Google consent URL. The redirect URI must be registered on the OAuth client. */
    public String buildAuthUrl() {
        if (!isClientConfigured()) {
            throw new IllegalStateException("GOOGLE_OAUTH_CLIENT_ID / SECRET not configured");
        }
        if (redirectUri.isBlank()) {
            throw new IllegalStateException("GOOGLE_OAUTH_REDIRECT_URI not configured");
        }
        byte[] nonce = new byte[16];
        new SecureRandom().nextBytes(nonce);
        String state = HexFormat.of().formatHex(nonce);
        pending = new Pending(state, System.currentTimeMillis() + STATE_TTL_MS);

        // access_type=offline + prompt=consent → Google always returns a refresh token.
        return AUTH_ENDPOINT
            + "?client_id="     + url(clientId)
            + "&redirect_uri="  + url(redirectUri)
            + "&response_type=code"
            + "&scope="         + url(SCOPE)
            + "&access_type=offline"
            + "&prompt=consent"
            + "&state="         + state;
    }

    /** Exchange the code, store the refresh token + account email. Returns the email (may be ""). */
    public String handleCallback(String code, String state) throws IOException {
        Pending p = pending;
        pending = null; // single-use
        if (p == null || !p.state().equals(state) || System.currentTimeMillis() > p.expiresAt()) {
            throw new IOException("OAuth state mismatch or expired — restart the connect flow");
        }

        String form = "code="          + url(code)
            + "&client_id="     + url(clientId)
            + "&client_secret=" + url(clientSecret)
            + "&redirect_uri="  + url(redirectUri)
            + "&grant_type=authorization_code";

        JsonNode tokens = postForm(TOKEN_ENDPOINT, form);
        String refreshToken = tokens.path("refresh_token").asText("");
        if (refreshToken.isBlank()) {
            throw new IOException("Google returned no refresh token: "
                + tokens.path("error_description").asText(tokens.toString()));
        }

        settings.set(SettingsService.REFRESH_TOKEN, refreshToken);
        // Any previously-stored folder id is not guaranteed visible to this client; clear it
        // so DriveService re-finds/creates the "Communicator" folder under the fresh grant.
        settings.set(SettingsService.DRIVE_FOLDER_ID, "");
        driveService.reset();

        String email = "";
        try {
            email = driveService.fetchAccountEmail();
        } catch (Exception e) {
            log.warn("[OAuth] connected but could not read account email: {}", e.getMessage());
        }
        settings.set(SettingsService.ACCOUNT_EMAIL, email);
        log.info("[OAuth] Google Drive connected{}", email.isBlank() ? "" : " as " + email);
        return email;
    }

    /** Revoke (best-effort) and forget the stored token. */
    public void disconnect() {
        String token = settings.getRefreshToken();
        if (!token.isBlank()) {
            try {
                postForm(REVOKE_ENDPOINT, "token=" + url(token));
            } catch (Exception e) {
                log.warn("[OAuth] revoke failed (token forgotten anyway): {}", e.getMessage());
            }
        }
        settings.set(SettingsService.REFRESH_TOKEN, "");
        settings.set(SettingsService.ACCOUNT_EMAIL, "");
        driveService.reset();
        log.info("[OAuth] Google Drive disconnected");
    }

    private JsonNode postForm(String endpoint, String form) throws IOException {
        HttpRequest req = HttpRequest.newBuilder()
            .uri(URI.create(endpoint))
            .timeout(Duration.ofSeconds(15))
            .header("Content-Type", "application/x-www-form-urlencoded")
            .POST(HttpRequest.BodyPublishers.ofString(form))
            .build();
        try {
            HttpResponse<String> r = httpClient.send(req, HttpResponse.BodyHandlers.ofString());
            JsonNode body = r.body() == null || r.body().isBlank()
                ? objectMapper.createObjectNode()
                : objectMapper.readTree(r.body());
            if (r.statusCode() / 100 != 2) {
                throw new IOException("Google " + r.statusCode() + ": "
                    + body.path("error_description").asText(body.path("error").asText(r.body())));
            }
            return body;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IOException("interrupted", e);
        }
    }

    private static String url(String v) {
        return URLEncoder.encode(v, StandardCharsets.UTF_8);
    }
}
