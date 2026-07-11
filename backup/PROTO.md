# Backup Service — Proto

> **Proto, not a flow.** The nightly backup pipeline is in [flows/](../flows/). This maps the two backup daemons + their seams.

Files: PostgresBackupService.java, FileBackupService.java, startup.sh, upload_to_drive.py, restore.py, Dockerfile, requirements.txt

## Role

Data protection. **Not Spring** — two plain `java.util.Timer` daemons compiled with `javac` and launched in parallel by `startup.sh`, plus a Python Google-Drive uploader. No HTTP server, no port. Runs on a fixed 24h timer (first run immediately at container start). `depends_on: postgres, fileRepository`.

## Internal wiring

```
startup.sh
  ├─ java PostgresBackupService &   (Timer, every 24h, first run at t=0)
  │    pg_dump -h postgresDB -p 5432 -U myapp_user -d my_database
  │        -F p --inserts --column-inserts --no-owner --no-privileges --clean --if-exists
  │      → /app/backups/postgres_backup_<ts>.sql
  │    → gzip -9 → .sql.gz
  │    → python3 upload_to_drive.py <file>
  └─ java FileBackupService &        (Timer, every 24h, first run at t=0)
       GET http://fileRepository:5000/backup   (3 retries)
         → /app/backups/files_backup_<ts>.zip
       → python3 upload_to_drive.py <file>

upload_to_drive.py: service-account-key.json (scope drive.file) → Drive folder 1vqdqkQTepjup2RODZr4-7_X-q5PE1bV3
restore.py: MANUAL only — not called by startup.sh
```

## Seams

**Outbound:**

| Callee | Trigger / why | Exit point |
|---|---|---|
| Postgres | logical dump of `my_database` | `pg_dump` subprocess (`postgresDB:5432`, `postgresql-client-17` from Dockerfile) |
| fileRepository | pull a zip of all media | `GET http://fileRepository:5000/backup` (`FileBackupService`) |
| Google Drive | store both artifacts off-box | `upload_to_drive.py` (service account, folder id hardcoded) |

**Inbound:** none (timer-driven, no callers).

## Gotchas / Technology Notes

- **Credentials are hardcoded + baked into the image.** DB user/pass (`myapp_user`/`example`) are string constants in `PostgresBackupService.java` (duplicated from compose, not env-driven — change the DB password and backups silently fail auth). `service-account-key.json` is `COPY`ed into the image (a real Google service-account secret in the build context) and the Drive `FOLDER_ID` is hardcoded in `upload_to_drive.py`.
- **Dump format is plain SQL with `--inserts --column-inserts`** — portable and human-readable, but **huge and slow to restore** (row-by-row INSERTs, not COPY). `--clean --if-exists` means the dump DROPs then recreates on restore (destructive). For a personal DB this is fine; at size, switch to `-Fc` custom format.
- **Restore is fully manual.** `restore.py` exists but nothing invokes it — recovering means running it by hand inside the container. There is no tested restore path and no verification that uploaded dumps are restorable.
- **No retention/pruning.** Every run uploads a new file to the same Drive folder forever; nothing deletes old backups. Local `/app/backups` also grows unbounded (no volume mount in compose → lives in the container layer, lost on `docker compose down` unless re-created; only the Drive copy persists).
- **`FileBackupService` depends on a `/backup` endpoint in fileRepository** producing a zip of all media volumes — if that endpoint changes shape, file backups break silently (logged only).
- **24h `Timer`, not cron.** Interval is measured from container start, so the backup time drifts with every restart (a container restarted at 3pm backs up at 3pm daily). No alignment to off-peak hours.
- **Port typo comment:** the pg_dump uses `-p 5432` (correct, internal), despite a comment mentioning 5433 (the host-exposed port). Harmless, but the comment misleads.

## Change Index

| Thing to change | Where |
|---|---|
| Backup interval | `PostgresBackupService`/`FileBackupService` `scheduleAtFixedRate(..., 24*60*60*1000)` |
| pg_dump flags / format | `PostgresBackupService.performBackup()` ProcessBuilder |
| DB credentials | `PostgresBackupService` constants (**hardcoded**, keep in sync with compose) |
| Media backup source endpoint | `FileBackupService.RESOURCE_REPOSITORY_URL` (`fileRepository:5000/backup`) |
| Google Drive folder | `upload_to_drive.py FOLDER_ID` |
| Drive credentials | `backup/service-account-key.json` (baked at build) |
| Restore | `restore.py` (run manually; wire into an endpoint/script if you want automation) |
| Local backup dir | `BACKUP_DIR=/app/backups` (no volume — add one to persist locally) |
