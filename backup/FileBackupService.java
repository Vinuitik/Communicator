import java.io.*;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.file.*;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Timer;
import java.util.TimerTask;

public class FileBackupService {
    private static final String BACKUP_DIR = "/app/backups";
    private static final String RESOURCE_REPOSITORY_URL = "http://fileRepository:5000/backup";
    
    public static void main(String[] args) {
        scheduleBackup();
    }

    private static void scheduleBackup() {
        Timer timer = new Timer();
        timer.scheduleAtFixedRate(new TimerTask() {
            @Override
            public void run() {
                performFileBackup();
            }
        }, 0, 24 * 60 * 60 * 1000); // Every 24 hours
    }

    private static void performFileBackup() {
        try {
            // Create backup directory if it doesn't exist
            Files.createDirectories(Paths.get(BACKUP_DIR));

            // Generate backup filename
            String timestamp = new SimpleDateFormat("yyyyMMdd_HHmmss").format(new Date());
            String backupFile = BACKUP_DIR + "/files_backup_" + timestamp + ".zip";

            System.out.println("Starting file backup process...");
            
            // Download backup from resource repository
            if (downloadBackupFromResourceRepository(backupFile)) {
                System.out.println("File backup created: " + backupFile);
                uploadToGoogleDrive(backupFile);
            } else {
                System.err.println("Failed to create file backup");
            }

        } catch (Exception e) {
            System.err.println("File backup process encountered an error:");
            e.printStackTrace();
        }
    }

    private static boolean downloadBackupFromResourceRepository(String outputPath) {
        int maxRetries = 3;
        int retryCount = 0;
        
        while (retryCount < maxRetries) {
            try {
                System.out.println("Requesting backup from resource repository at: " + RESOURCE_REPOSITORY_URL + 
                                 " (attempt " + (retryCount + 1) + "/" + maxRetries + ")");
                
                URL url = new URL(RESOURCE_REPOSITORY_URL);
                HttpURLConnection connection = (HttpURLConnection) url.openConnection();
                connection.setRequestMethod("GET");
                connection.setConnectTimeout(30000); // 30 seconds
                connection.setReadTimeout(300000);   // 5 minutes for large files
                
                int responseCode = connection.getResponseCode();
                
                if (responseCode == HttpURLConnection.HTTP_OK) {
                    // Check content type to ensure we got a zip file
                    String contentType = connection.getContentType();
                    System.out.println("Response content type: " + contentType);
                    
                    if (contentType != null && contentType.contains("application/zip")) {
                        // Download the file
                        try (InputStream inputStream = connection.getInputStream();
                             FileOutputStream outputStream = new FileOutputStream(outputPath)) {
                            
                            byte[] buffer = new byte[8192];
                            int bytesRead;
                            long totalBytesRead = 0;
                            
                            while ((bytesRead = inputStream.read(buffer)) != -1) {
                                outputStream.write(buffer, 0, bytesRead);
                                totalBytesRead += bytesRead;
                            }
                            
                            System.out.println("Downloaded " + totalBytesRead + " bytes");
                            connection.disconnect();
                            return true;
                        }
                    } else {
                        // Check if it's a JSON response indicating no files
                        try (BufferedReader reader = new BufferedReader(
                                new InputStreamReader(connection.getInputStream()))) {
                            String line;
                            StringBuilder response = new StringBuilder();
                            while ((line = reader.readLine()) != null) {
                                response.append(line);
                            }
                            System.out.println("Server response: " + response.toString());
                            
                            if (response.toString().contains("No files found to back up")) {
                                System.out.println("No files available for backup - this is normal for empty repositories");
                                connection.disconnect();
                                return false; // Don't upload empty backup
                            }
                        }
                    }
                } else {
                    System.err.println("HTTP request failed with response code: " + responseCode);
                    
                    // Read error response
                    try (BufferedReader reader = new BufferedReader(
                            new InputStreamReader(connection.getErrorStream()))) {
                        String line;
                        while ((line = reader.readLine()) != null) {
                            System.err.println("Error response: " + line);
                        }
                    }
                }
                
                connection.disconnect();
                
            } catch (Exception e) {
                System.err.println("Error downloading backup from resource repository (attempt " + 
                                 (retryCount + 1) + "):");
                e.printStackTrace();
            }
            
            retryCount++;
            if (retryCount < maxRetries) {
                try {
                    System.out.println("Waiting 30 seconds before retry...");
                    Thread.sleep(30000); // Wait 30 seconds before retry
                } catch (InterruptedException ie) {
                    Thread.currentThread().interrupt();
                    break;
                }
            }
        }
        
        System.err.println("Failed to download backup after " + maxRetries + " attempts");
        return false;
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
                System.out.println("File backup upload successful.");
                
                // Clean up local backup file after successful upload
                try {
                    Files.deleteIfExists(Paths.get(filePath));
                    System.out.println("Local backup file cleaned up: " + filePath);
                } catch (Exception e) {
                    System.err.println("Warning: Could not clean up local backup file: " + e.getMessage());
                }
            } else {
                System.err.println("File backup upload failed with exit code " + exitCode);
            }
        } catch (Exception e) {
            System.err.println("Upload process encountered an error:");
            e.printStackTrace();
        }
    }
}
