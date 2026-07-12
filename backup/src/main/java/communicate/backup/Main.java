package communicate.backup;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * Communicator backup service.
 *
 * Encrypted DB + media backups to Google Drive over OAuth. Ported from the
 * ObsidianOptimizer sync subsystem (AES-256-GCM encryption, OAuth refresh-token
 * Drive client, retention/pruning, restore). Single-tenant: one owner's Google
 * account, connected once via the browser consent flow.
 */
@SpringBootApplication
@EnableScheduling
public class Main {
    public static void main(String[] args) {
        SpringApplication.run(Main.class, args);
    }
}
