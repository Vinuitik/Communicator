# Flow: Nightly Backup (Postgres + media → Google Drive)

Off-box data protection. Two independent daemons dump the DB and the media, compress, and push to Google Drive. **backup service → Postgres + fileRepository → Google Drive.** No UI, no nginx — this flow runs entirely on the docker network + one cloud egress.

Protos: [backup](../backup/PROTO.md) · [resourceRepository](../resourceRepository/flask-template/PROTO.md)

---

## The two daemons (parallel, every 24h from container start)

```
startup.sh
 ├─ PostgresBackupService (Java Timer)
 │    pg_dump -h postgresDB -d my_database  (plain SQL, --inserts --clean --if-exists)
 │      → /app/backups/postgres_backup_<ts>.sql  → gzip -9
 │      → python3 upload_to_drive.py  ─► Google Drive folder 1vqdqkQTepjup2RODZr4-7_X-q5PE1bV3
 └─ FileBackupService (Java Timer)
      GET http://fileRepository:5000/backup   (zip of all media volumes, 3 retries)
        → /app/backups/files_backup_<ts>.zip
        → python3 upload_to_drive.py  ─► same Drive folder (service-account-key.json, scope drive.file)
```

**Achieves:** a daily off-site copy of both the relational data (friends, knowledge, analytics, groups) and the media blobs. Note it backs up **Postgres only** — **Redis** is **NOT** backed up (it's derived/cache, regenerable by the [knowledge-RAG flow](knowledge-rag.md) at Gemini cost). The `pg_dump` has no schema/table filter, so it captures whatever's in `my_database` wholesale — since ai_agent's RAG data (chunks, embeddings, facts, references) moved from a separate unbacked-up MongoDB into this same Postgres database (2026-07-23, see [knowledge-rag.md](knowledge-rag.md)), it's now covered by this same nightly backup for free, closing a gap that used to exist.

---

## Notes (from the backup proto)

- **Restore is manual & untested:** `restore.py` exists but nothing calls it; there's no verification that a dump restores cleanly.
- **Hardcoded everything:** DB creds are string constants (must stay in sync with compose), the Drive folder id and `service-account-key.json` are baked into the image.
- **No retention:** every run adds a new Drive file forever; local `/app/backups` has no volume so it lives in the container layer.
- **Drift, not cron:** the 24h `Timer` counts from container start, so backup time moves on every restart.

## Change Index (flow-level)

| Want to change | Where |
|---|---|
| Backup interval | `PostgresBackupService`/`FileBackupService` `scheduleAtFixedRate(...)` |
| Dump format/flags | `PostgresBackupService.performBackup()` |
| Media zip contents | `resourceRepository blueprints/backup.py` |
| Drive destination / creds | `backup/upload_to_drive.py FOLDER_ID` + `backup/service-account-key.json` |
| Also back up Redis | not implemented |
| Restore | `backup/restore.py` (manual) |
