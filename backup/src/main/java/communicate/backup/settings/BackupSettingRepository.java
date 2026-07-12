package communicate.backup.settings;

import org.springframework.data.jpa.repository.JpaRepository;

public interface BackupSettingRepository extends JpaRepository<BackupSetting, String> {
}
