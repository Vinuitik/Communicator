# Backup Service — Proto

> **Proto, not a flow.** Maps the backup Spring service + its seams. Ported from the
> ObsidianOptimizer sync subsystem (OAuth Drive, AES-256-GCM encryption, retention, restore).

Files: Main.java, crypto/EncryptionService.java, drive/DriveService.java, drive/BackupOAuthService.java, service/DbBackupService.java, service/FileBackupService.java, service/BackupService.java, web/BackupController.java, scheduler/BackupScheduler.java, settings/SettingsService.java, settings/BackupSetting.java, resources/application.yml, Dockerfile, pom.xml

## Role

Data protection. **Spring Boot** service (Java 21, port 8091), same stack as friend/group.
Replaces the old standalone `java.util.Timer` + service-account-Python container. Encrypted
DB + media backups to Google Drive over **OAuth** (service accounts are dead for Drive). Runs
a nightly `@Scheduled` cron + REST triggers. `depends_on: postgres, fileRepository`. Reached
through nginx at `/backup/**`.

## Internal wiring

```
BackupScheduler.scheduledBackup()  @Scheduled(backup.cron, default 03:00 UTC), gated on `enabled`
  └─ BackupService.runScheduledBackup()          (single-flight ReentrantLock)
        ├─ DbBackupService.backupNow()
        │    pg_dump -Fc -h postgresDB -U myapp_user -d my_database  (PGPASSWORD env)
        │      → EncryptionService.encrypt (gzip → AES-256-GCM)
        │      → DriveService.uploadBackup(kind=db)  → prune to BACKUP_KEEP
        └─ FileBackupService.backupNow()
             GET http://fileRepository:5000/backup  (zip of all media)
               → encrypt → DriveService.uploadBackup(kind=files) → prune

BackupController  /backup/**  (via nginx, prefix preserved)
  GET  /backup/oauth/url        → 302 Google consent (BackupOAuthService.buildAuthUrl)
  GET  /backup/oauth/callback   → code exchange → refresh_token to DB (handleCallback)
  POST /backup/disconnect       → revoke + forget token
  GET  /backup/status           → connected, account, enabled, db/files counts, quota, running
  POST /backup/run              → 202, full backup on worker thread
  POST /backup/restore?force=   → 400 if blocked, else 202: pg_restore + POST fileRepository/restore
  POST /backup/enabled?value=   → toggle nightly cron

State: `backup_settings` KV table (refresh_token, account_email, drive_folder_id, device_id,
enabled). Auto-created by JPA ddl-auto=update. Client id/secret/passphrase come from ENV, not DB.
```

## Seams

**Outbound:**

| Callee | Trigger / why | Exit point |
|---|---|---|
| Postgres | logical dump / restore of `my_database` | `pg_dump -Fc` / `pg_restore` subprocess (`DbBackupService`, `postgresql-client-17` in image) |
| fileRepository | pull media zip / push it back | `GET /backup`, `POST /restore` (`FileBackupService`) |
| Google Drive | store encrypted backups off-box | `DriveService` (OAuth refresh token, folder "Communicator") |
| Google OAuth | one-time consent → refresh token | `BackupOAuthService` (accounts.google.com, oauth2.googleapis.com) |

**Inbound:** nginx `/backup/**` → REST (`BackupController`). No other service calls it.

## External setup (one-time)

1. Google Cloud Console → OAuth 2.0 Client (Web app), scope `.../auth/drive.file`.
   Reuses ObsidianOptimizer's client (same Cloud project).
2. Add `http://localhost:8090/backup/oauth/callback` to that client's **Authorized redirect URIs**.
3. `.env`: `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `GOOGLE_OAUTH_REDIRECT_URI`,
   `SYNC_PASSPHRASE` (see `.env.example`).
4. `docker compose up -d` → open `http://localhost:8090/backup/oauth/url` → consent once.

## Gotchas / Technology Notes

- **OAuth scope `drive.file`** — the app only sees files it created. The by-name "Communicator"
  folder lookup can't collide with the user's files. Trade-off: files created by a DIFFERENT
  client (e.g. the old service account) are invisible here.
- **Refresh tokens can die.** If the OAuth client is in "Testing" publishing status, Google
  expires refresh tokens after ~7 days — set it to "In production". Also dies if the user
  revokes access. Failure mode: backups throw, `/status` still says connected → re-consent.
- **Passphrase is the crown jewel.** `SYNC_PASSPHRASE` (env) derives the AES key via PBKDF2
  (fixed salt `ObsidianSyncSalt`, 310k iters — IDENTICAL to OO, so backups interop). Lose it and
  every Drive backup is unrecoverable. Change it and all existing backups become undecryptable.
- **Restore is destructive.** `pg_restore --clean --if-exists` drops objects first. Guarded to an
  empty DB (checks `SELECT COUNT(*) FROM friend`) unless `force=true`. File restore overwrites
  media in place. **Restart the app services after a DB restore** (beans/caches hold stale rows).
- **pg client major must be ≥ server major.** Server is `pgvector/pgvector:pg17`; the image pins
  `postgresql-client-17`. Bump both together on a Postgres major upgrade.
- **`-Fc` custom dump, not plain SQL** (the old container used `--inserts` plain SQL — huge/slow).
  Custom format restores across minor versions and rebuilds indexes on restore.
- **Retention is hard-delete.** `BACKUP_KEEP` (default 3) newest of each kind survive; older are
  `files().delete()`d (bypasses trash) so quota actually frees. No local backup dir — nothing is
  kept on the container's disk; the temp dump is deleted after upload.
- **Single-flight.** `BackupService` ReentrantLock: a manual `/run` never races the nightly cron;
  the second caller gets 409. All work is on one daemon `backup-worker` thread → endpoints return 202.
- **Secrets split:** client id/secret + passphrase live in ENV (`.env`, gitignored). Only the
  OAuth *result* (refresh token, email) + folder id land in the DB (`backup_settings`, plaintext —
  same trust domain as the DB it's backing up).
- **nginx prefix preserved.** `location /backup/` uses `proxy_pass http://backup_service;` (NO
  trailing slash) so the controller's `/backup/**` mapping and the OAuth redirect URI both resolve.
- **Zip-slip guard** on `fileRepository POST /restore`: each zip member must resolve under `BASE_DIR`.
- **No UI yet** `[NOT IMPLEMENTED]` — connect + trigger via REST/browser. A React panel can wrap
  these endpoints later (OO had one).

## Change Index

| Thing to change | Where |
|---|---|
| Backup schedule | `BACKUP_CRON` env / `backup.cron` (`BackupScheduler`) |
| Dumps/zips retained | `BACKUP_KEEP` env / `backup.keep` |
| pg_dump / pg_restore flags | `DbBackupService.backupNow()` / `restore()` |
| Restore empty-guard | `DbBackupService.restoreBlockedReason()` (`SELECT COUNT(*) FROM friend`) |
| DB credentials | `SPRING_DATASOURCE_*` env (compose) |
| Media backup source / restore | `backup.file-repository-url` + `fileRepository` `/backup`,`/restore` |
| Drive folder name | `DriveService.ROOT_FOLDER_NAME` ("Communicator") |
| Encryption passphrase | `SYNC_PASSPHRASE` env / `backup.passphrase` (`EncryptionService`) |
| PBKDF2 salt/iterations | `EncryptionService` constants (match OO) |
| OAuth client id/secret/redirect | `GOOGLE_OAUTH_*` env (`.env`) |
| OAuth flow / scope / endpoints | `BackupOAuthService` |
| Drive retry policy | `DriveService.isTransient()` + `withRetry()` |
| Which Drive errors retry | `DriveService.isTransient()` |
| pg client version | `Dockerfile` `postgresql-client-17` (match server major) |
| Service port | `application.yml server.port` (8091) + nginx upstream `backup_service` |
| nginx route | `nginx.conf` `location /backup/` |
| Persisted runtime state | `backup_settings` table via `SettingsService` |
