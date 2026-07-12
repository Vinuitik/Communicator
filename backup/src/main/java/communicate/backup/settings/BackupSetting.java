package communicate.backup.settings;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * One key-value row of mutable runtime state that must survive a container restart:
 * the OAuth refresh token, connected account email, Drive folder id, device id, and
 * the auto-backup enable flag. Client id/secret/passphrase are NOT here — those come
 * from env (application.yml) so secrets stay out of the DB.
 */
@Entity
@Table(name = "backup_settings")
public class BackupSetting {

    @Id
    @Column(name = "key", nullable = false, updatable = false)
    private String key;

    @Column(name = "value", columnDefinition = "TEXT")
    private String value;

    protected BackupSetting() {}

    public BackupSetting(String key, String value) {
        this.key = key;
        this.value = value;
    }

    public String getKey()   { return key; }
    public String getValue() { return value; }
    public void setValue(String value) { this.value = value; }
}
