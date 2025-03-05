import java.io.*;
import java.nio.file.*;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Timer;
import java.util.TimerTask;

public class PostgresBackupService {
    private static final String BACKUP_DIR = "backups";
    private static final String DB_NAME = "my_database";
    private static final String DB_USER = "root";
    private static final String DB_PASSWORD = "example";
    private static final String DB_HOST = "localhost";
    private static final String BACKUP_TOOL = "pg_dump"; // Ensure pg_dump is installed

    public static void main(String[] args) {
        scheduleBackup(); // Run every 24 hours
    }

    private static void scheduleBackup() {
        Timer timer = new Timer();
        timer.scheduleAtFixedRate(new TimerTask() {
            @Override
            public void run() {
                performBackup();
            }
        }, 0, 24 * 60 * 60 * 1000); // Every 24 hours
    }

    private static void performBackup() {
        try {
            // Create backup directory if it doesn't exist
            Files.createDirectories(Paths.get(BACKUP_DIR));

            // Generate backup filename
            String timestamp = new SimpleDateFormat("yyyyMMdd_HHmmss").format(new Date());
            String backupFile = BACKUP_DIR + "/postgres_backup_" + timestamp + ".sql.gz";

            // Run pg_dump
            ProcessBuilder pb = new ProcessBuilder(
                    "sh", "-c",
                    "PGPASSWORD=" + DB_PASSWORD + " " + BACKUP_TOOL + " -h " + DB_HOST + " -U " + DB_USER + " " + DB_NAME + " | gzip > " + backupFile
            );
            pb.environment().put("PGPASSWORD", DB_PASSWORD);
            pb.redirectErrorStream(true);
            Process process = pb.start();
            
            // Read and print process output (for debugging)
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    System.out.println(line);
                }
            }

            int exitCode = process.waitFor();
            if (exitCode == 0) {
                System.out.println("Backup created: " + backupFile);
                uploadToGoogleDrive(backupFile);
            } else {
                System.err.println("Backup failed with exit code " + exitCode);
            }

        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private static void uploadToGoogleDrive(String filePath) {
        // Call Python script for Google Drive upload
        try {
            ProcessBuilder pb = new ProcessBuilder("python3", "upload_to_drive.py", filePath);
            pb.redirectErrorStream(true);
            Process process = pb.start();
            
            // Read and print process output (for debugging)
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    System.out.println(line);
                }
            }

            process.waitFor();
            System.out.println("Upload finished.");
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
