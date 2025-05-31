import java.io.*;
import java.nio.file.*;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Timer;
import java.util.TimerTask;

public class PostgresBackupService {
    private static final String BACKUP_DIR = "/app/backups";
    private static final String DB_NAME = "my_database";
    private static final String DB_USER = "myapp_user";
    private static final String DB_PASSWORD = "example";
    private static final String DB_HOST = "postgresDB";
    private static final String BACKUP_TOOL = "pg_dump";

    public static void main(String[] args) {
        scheduleBackup();
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
            String uncompressedBackupFile = BACKUP_DIR + "/postgres_backup_" + timestamp + ".sql";
            String compressedBackupFile = uncompressedBackupFile + ".gz";

            // Comprehensive pg_dump command with full data preservation
            ProcessBuilder pbDump = new ProcessBuilder(
                "sh", "-c",
                "PGPASSWORD=" + DB_PASSWORD + " " + BACKUP_TOOL +
                " -h " + DB_HOST +           // Specify host
                " -p 5432" +             // Specify port (default is 5432, but using 5433 as per your example)
                " -U " + DB_USER +           // Specify user
                " -d " + DB_NAME +           // Specify database
                " -v " +                     // Verbose output
                " -f " + uncompressedBackupFile +  // Output file
                " -F p " +                   // Plain text format (full SQL)
                " --column-inserts " +       // Explicit column names in INSERT statements
                " --inserts " +              // Use INSERT instead of COPY
                " --no-owner " +             // Exclude ownership statements
                " --no-privileges " +        // Exclude privilege grants
                " --clean " +                // Include DROP statements before CREATE
                " --if-exists "              // Add IF EXISTS to DROP statements
            );

            pbDump.environment().put("PGPASSWORD", DB_PASSWORD);
            pbDump.redirectErrorStream(true);
            
            // Execute backup
            Process dumpProcess = pbDump.start();
            
            // Capture and log dump output
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(dumpProcess.getInputStream()))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    System.out.println(line);
                }
            }

            // Wait for dump process to complete
            int dumpExitCode = dumpProcess.waitFor();
            
            if (dumpExitCode == 0) {
                // Compress the backup file using gzip
                ProcessBuilder pbCompress = new ProcessBuilder(
                    "gzip", 
                    "-9",           // Maximum compression level
                    "-v",           // Verbose output
                    uncompressedBackupFile  // File to compress
                );
                
                Process compressProcess = pbCompress.start();
                
                // Capture compression output
                try (BufferedReader reader = new BufferedReader(new InputStreamReader(compressProcess.getInputStream()))) {
                    String line;
                    while ((line = reader.readLine()) != null) {
                        System.out.println(line);
                    }
                }
                
                int compressExitCode = compressProcess.waitFor();
                
                if (compressExitCode == 0) {
                    System.out.println("Compressed backup created: " + compressedBackupFile);
                    uploadToGoogleDrive(compressedBackupFile);
                } else {
                    System.err.println("Compression failed with exit code " + compressExitCode);
                }
            } else {
                System.err.println("Backup dump failed with exit code " + dumpExitCode);
            }

        } catch (Exception e) {
            System.err.println("Backup process encountered an error:");
            e.printStackTrace();
        }
    }

    private static void uploadToGoogleDrive(String filePath) {
        try {
            ProcessBuilder pb = new ProcessBuilder("python3", "upload_to_drive.py", filePath);
            pb.redirectErrorStream(true);
            Process process = pb.start();
            
            // Capture upload process output
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    System.out.println(line);
                }
            }

            int exitCode = process.waitFor();
            if (exitCode == 0) {
                System.out.println("Upload successful.");
            } else {
                System.err.println("Upload failed with exit code " + exitCode);
            }
        } catch (Exception e) {
            System.err.println("Upload process encountered an error:");
            e.printStackTrace();
        }
    }
}