# Backup Service

This backup service now handles both PostgreSQL database backups and file backups from the resource repository.

## Components

### PostgresBackupService.java
- Handles PostgreSQL database backups using pg_dump
- Compresses backups with gzip
- Uploads to Google Drive
- Runs daily at scheduled intervals

### FileBackupService.java
- Connects to the fileRepository service via HTTP
- Downloads a zip backup of all stored files
- Uploads to Google Drive
- Runs daily at scheduled intervals
- Includes retry logic for network failures

### startup.sh
- Starts both backup services in parallel
- Handles graceful shutdown
- Monitors both processes

## Configuration

The backup services are configured via the following environment variables:
- Database connection details are hardcoded (can be moved to env vars if needed)
- Google Drive credentials are in `service-account-key.json`
- Backup directory: `/app/backups`

## Dependencies

- PostgreSQL client tools
- Python 3 with Google Drive API libraries
- Java 17+
- Network access to both postgresDB and fileRepository services

## File Backup Process

1. FileBackupService makes an HTTP GET request to `http://fileRepository:5000/backup`
2. The fileRepository service creates a zip archive of all files in its storage directories
3. The zip file is downloaded and saved locally
4. The backup is uploaded to Google Drive using the Python script
5. Local backup file is cleaned up after successful upload

## Schedule

Both services run immediately on startup and then every 24 hours thereafter.

## Error Handling

- Network failures are retried up to 3 times with 30-second delays
- Empty repositories (no files to backup) are handled gracefully
- All errors are logged to stdout/stderr
- Failed uploads keep local backup files for manual intervention
