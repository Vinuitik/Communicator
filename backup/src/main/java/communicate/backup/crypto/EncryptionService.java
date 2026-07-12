package communicate.backup.crypto;

import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.Cipher;
import javax.crypto.SecretKey;
import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.PBEKeySpec;
import javax.crypto.spec.SecretKeySpec;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.security.spec.KeySpec;
import java.util.Arrays;
import java.util.zip.GZIPInputStream;
import java.util.zip.GZIPOutputStream;

/**
 * AES-256-GCM + gzip, ported verbatim from ObsidianOptimizer's VaultEncryptionService.
 *
 * <p>The salt, iteration count, key size and wire format are IDENTICAL to OO, so a backup
 * encrypted here decrypts there and vice-versa as long as the passphrase matches. Passphrase
 * comes from the {@code SYNC_PASSPHRASE} env var (application.yml {@code backup.passphrase});
 * blank ⇒ encryption disabled and backups are refused (never silently uploaded in the clear).
 */
@Service
public class EncryptionService {

    private static final Logger log = LoggerFactory.getLogger(EncryptionService.class);

    // Fixed salt — same passphrase always derives the same AES key (multi-device / cross-app).
    private static final byte[] PBKDF2_SALT = "ObsidianSyncSalt".getBytes(StandardCharsets.UTF_8);
    private static final int    PBKDF2_ITERATIONS = 310_000;
    private static final int    KEY_BITS          = 256;
    private static final int    IV_BYTES          = 12;  // GCM nonce
    private static final int    GCM_TAG_BITS      = 128;

    @Value("${backup.passphrase:}")
    private String passphrase;

    private volatile SecretKey key;

    @PostConstruct
    public synchronized void init() {
        if (passphrase == null || passphrase.isBlank()) {
            key = null;
            log.warn("[Encryption] backup passphrase not set — encryption disabled, backups will be refused");
            return;
        }
        try {
            KeySpec spec = new PBEKeySpec(passphrase.toCharArray(), PBKDF2_SALT, PBKDF2_ITERATIONS, KEY_BITS);
            SecretKeyFactory skf = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256");
            key = new SecretKeySpec(skf.generateSecret(spec).getEncoded(), "AES");
            log.info("[Encryption] AES-256-GCM key derived from passphrase");
        } catch (Exception e) {
            key = null;
            log.error("[Encryption] key derivation failed: {}", e.getMessage());
        }
    }

    public boolean isConfigured() {
        return key != null;
    }

    /** Compress (gzip) then encrypt. Output: [12B IV][GCM ciphertext + 16B auth tag]. */
    public byte[] encrypt(byte[] plaintext) throws Exception {
        byte[] compressed = gzip(plaintext);

        byte[] iv = new byte[IV_BYTES];
        new SecureRandom().nextBytes(iv);

        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.ENCRYPT_MODE, key, new GCMParameterSpec(GCM_TAG_BITS, iv));
        byte[] ciphertext = cipher.doFinal(compressed);

        byte[] out = new byte[IV_BYTES + ciphertext.length];
        System.arraycopy(iv,         0, out, 0,        IV_BYTES);
        System.arraycopy(ciphertext, 0, out, IV_BYTES, ciphertext.length);
        return out;
    }

    /** Decrypt then decompress. Expects the format produced by {@link #encrypt}. */
    public byte[] decrypt(byte[] encryptedBytes) throws Exception {
        byte[] iv         = Arrays.copyOfRange(encryptedBytes, 0,        IV_BYTES);
        byte[] ciphertext = Arrays.copyOfRange(encryptedBytes, IV_BYTES, encryptedBytes.length);

        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(GCM_TAG_BITS, iv));
        byte[] compressed = cipher.doFinal(ciphertext);

        return ungzip(compressed);
    }

    private static byte[] gzip(byte[] data) throws Exception {
        ByteArrayOutputStream bos = new ByteArrayOutputStream();
        try (GZIPOutputStream gz = new GZIPOutputStream(bos)) {
            gz.write(data);
        }
        return bos.toByteArray();
    }

    private static byte[] ungzip(byte[] data) throws Exception {
        ByteArrayOutputStream bos = new ByteArrayOutputStream();
        try (GZIPInputStream gz = new GZIPInputStream(new ByteArrayInputStream(data))) {
            gz.transferTo(bos);
        }
        return bos.toByteArray();
    }
}
