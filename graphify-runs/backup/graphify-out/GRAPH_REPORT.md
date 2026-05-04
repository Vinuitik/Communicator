# Graph Report - .  (2026-05-04)

## Corpus Check
- Corpus is ~1,870 words - fits in a single context window. You may not need a graph.

## Summary
- 42 nodes · 50 edges · 11 communities detected
- Extraction: 90% EXTRACTED · 10% INFERRED · 0% AMBIGUOUS · INFERRED: 5 edges (avg confidence: 0.85)
- Token cost: 620 input · 890 output

## Community Hubs (Navigation)
- [[_COMMUNITY_File Backup Service|File Backup Service]]
- [[_COMMUNITY_Postgres Backup Service|Postgres Backup Service]]
- [[_COMMUNITY_Backup Storage|Backup Storage]]
- [[_COMMUNITY_Google Drive Integration|Google Drive Integration]]
- [[_COMMUNITY_Scheduled Backup|Scheduled Backup]]
- [[_COMMUNITY_Restore Authentication|Restore Authentication]]
- [[_COMMUNITY_Restore Extraction|Restore Extraction]]
- [[_COMMUNITY_DB Restore|DB Restore]]
- [[_COMMUNITY_Drive Download|Drive Download]]
- [[_COMMUNITY_Latest Backup Lookup|Latest Backup Lookup]]
- [[_COMMUNITY_Service Bootstrap|Service Bootstrap]]

## God Nodes (most connected - your core abstractions)
1. `PostgresBackupService` - 8 edges
2. `FileBackupService` - 7 edges
3. `Google Drive` - 7 edges
4. `FileBackupService` - 6 edges
5. `PostgresBackupService` - 5 edges
6. `Backup Service` - 3 edges
7. `startup.sh` - 3 edges
8. `google-auth-httplib2` - 3 edges
9. `Backup Directory (/app/backups)` - 3 edges
10. `authenticate()` - 2 edges

## Surprising Connections (you probably didn't know these)
- `google-auth` --rationale_for--> `Google Drive`  [EXTRACTED]
  backup/requirements.txt → backup/README_BACKUP.md
- `google-api-python-client` --rationale_for--> `Google Drive`  [EXTRACTED]
  backup/requirements.txt → backup/README_BACKUP.md
- `google-auth-httplib2` --rationale_for--> `Google Drive`  [EXTRACTED]
  backup/requirements.txt → backup/README_BACKUP.md

## Communities

### Community 0 - "File Backup Service"
Cohesion: 0.43
Nodes (1): FileBackupService

### Community 1 - "Postgres Backup Service"
Cohesion: 0.47
Nodes (1): PostgresBackupService

### Community 2 - "Backup Storage"
Cohesion: 0.4
Nodes (5): Backup Directory (/app/backups), gzip compression, pg_dump, PostgresBackupService, PostgreSQL Database (postgresDB)

### Community 3 - "Google Drive Integration"
Cohesion: 0.6
Nodes (5): Google Drive, service-account-key.json, google-api-python-client, google-auth, google-auth-httplib2

### Community 4 - "Scheduled Backup"
Cohesion: 0.5
Nodes (4): Daily Backup Schedule, FileBackupService, fileRepository Service, Retry Logic (3 retries, 30s delay)

### Community 5 - "Restore Authentication"
Cohesion: 0.67
Nodes (2): authenticate(), Authenticate with Google Drive using a service account.

### Community 6 - "Restore Extraction"
Cohesion: 1.0
Nodes (2): extract_zip(), Extract a zip file and return the extracted SQL file path.

### Community 7 - "DB Restore"
Cohesion: 1.0
Nodes (2): get_latest_backup(), Get the latest backup file from Google Drive.

### Community 8 - "Drive Download"
Cohesion: 1.0
Nodes (2): download_file(), Download a file from Google Drive.

### Community 9 - "Latest Backup Lookup"
Cohesion: 1.0
Nodes (2): Restore the PostgreSQL database from a SQL dump., restore_postgres()

### Community 11 - "Service Bootstrap"
Cohesion: 1.0
Nodes (2): Backup Service, startup.sh

## Knowledge Gaps
- **11 isolated node(s):** `Authenticate with Google Drive using a service account.`, `Get the latest backup file from Google Drive.`, `Download a file from Google Drive.`, `Extract a zip file and return the extracted SQL file path.`, `Restore the PostgreSQL database from a SQL dump.` (+6 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `File Backup Service`** (7 nodes): `FileBackupService`, `.downloadBackupFromResourceRepository()`, `.main()`, `.performFileBackup()`, `.scheduleBackup()`, `.uploadToGoogleDrive()`, `FileBackupService.java`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Postgres Backup Service`** (6 nodes): `PostgresBackupService.java`, `PostgresBackupService`, `.main()`, `.performBackup()`, `.scheduleBackup()`, `.uploadToGoogleDrive()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Restore Authentication`** (3 nodes): `authenticate()`, `restore.py`, `Authenticate with Google Drive using a service account.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Restore Extraction`** (2 nodes): `extract_zip()`, `Extract a zip file and return the extracted SQL file path.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `DB Restore`** (2 nodes): `get_latest_backup()`, `Get the latest backup file from Google Drive.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Drive Download`** (2 nodes): `download_file()`, `Download a file from Google Drive.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Latest Backup Lookup`** (2 nodes): `Restore the PostgreSQL database from a SQL dump.`, `restore_postgres()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Service Bootstrap`** (2 nodes): `Backup Service`, `startup.sh`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Google Drive` connect `Google Drive Integration` to `Backup Storage`, `Scheduled Backup`?**
  _High betweenness centrality (0.061) - this node is a cross-community bridge._
- **Why does `PostgresBackupService` connect `Backup Storage` to `Google Drive Integration`, `Service Bootstrap`, `Scheduled Backup`?**
  _High betweenness centrality (0.060) - this node is a cross-community bridge._
- **Why does `FileBackupService` connect `Scheduled Backup` to `Google Drive Integration`, `Backup Storage`, `Service Bootstrap`?**
  _High betweenness centrality (0.045) - this node is a cross-community bridge._
- **What connects `Authenticate with Google Drive using a service account.`, `Get the latest backup file from Google Drive.`, `Download a file from Google Drive.` to the rest of the system?**
  _11 weakly-connected nodes found - possible documentation gaps or missing edges._