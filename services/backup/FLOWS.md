# Flow: Nightly Backup (Postgres + media → Google Drive)

Off-box data protection. Two independent daemons dump the DB and the media, compress, and push to Google Drive. **backup service → Postgres + fileRepository → Google Drive.** No UI, no nginx — this flow runs entirely on the docker network + one cloud egress.

Protos: [backup](PROTO.md) · [resourceRepository](../resourceRepository/flask-template/PROTO.md)

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

**Achieves:** a daily off-site copy of both the relational data (friends, knowledge, analytics, groups) and the media blobs. Note it backs up **Postgres only** — **Redis** is **NOT** backed up (it's derived/cache, regenerable by the [knowledge-RAG flow](../ai_agent/FLOWS.md#knowledge--validated-facts-the-rag--fact-checking-pipeline) at Gemini cost). The `pg_dump` has no schema/table filter, so it captures whatever's in `my_database` wholesale — since ai_agent's RAG data (chunks, embeddings, facts, references) moved from a separate unbacked-up MongoDB into this same Postgres database (2026-07-23, see [ai_agent FLOWS.md](../ai_agent/FLOWS.md#knowledge--validated-facts-the-rag--fact-checking-pipeline)), it's now covered by this same nightly backup for free, closing a gap that used to exist.

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

---

**Staleness note (found, not fixed, while adding the section below):** everything above this
line describes an older architecture (`startup.sh`, Python `upload_to_drive.py`, a
service-account key) that no longer matches this module's actual code. The real current
implementation is OAuth-based Java: `drive/DriveService.java` + `drive/BackupOAuthService.java`
+ `crypto/EncryptionService.java` + `service/DbBackupService.java` (nightly `pg_dump -Fc`,
scheduled by `scheduler/BackupScheduler.java`, reached via `web/BackupController.java` at
`/backup/**`). Flagging this drift rather than rewriting the whole file — out of scope for
this session.

# Flow: Offline-Bundle Export (read-model snapshot → Google Drive)
Files: DriveService.java (`uploadOrReplace`), EncryptionService.java (`encrypt`) — the
orchestrator itself, `BundleExportService.java`, lives in `services/bootstrap` (see that
module's FLOWS.md), not here.

Read-tier counterpart to the write-path's `_mailbox` relay (MailboxConsumeService, also in
bootstrap): instead of queued write-intents, this is a periodically-refreshed encrypted
**snapshot** of current friends/groups/connections/meetings/scheduling-presets, so a device
with an empty or evicted local cache can rebuild offline instead of just failing. Shape and
rationale: `docs/designs/offline-pwa-plan.md`'s "T0" section.

```
BundleExportService (bootstrap, own class+FLOWS.md there)
  gathers friend+group+connections+meeting+scheduling-preset data
    → JSON (OfflineBundle/BundleRow records, bootstrap)
    → EncryptionService.encrypt()          (AES-256-GCM, same scheme as the mailbox path)
    → DriveService.uploadOrReplace(bytes, "offline-bundle.json.enc", "offline-bundle")
         → root "Communicator" Drive folder — SAME account/folder as backups and the
           mailbox, DIFFERENT filename, so it never collides with either.
```

- `DriveService.uploadOrReplace(bytes, name, kind)`: find-or-replace a single named file in
  the root folder — overwrites content in place on every run (unlike `uploadBackup`, which
  always creates a new timestamped file and relies on the caller to prune old ones). One
  current copy only, no history. To change the destination file name:
  `BundleExportService.BUNDLE_FILE_NAME` (bootstrap).
- The frontend's `drivePull.ts` reads this file directly from Drive using the
  `accessToken`/`encryptionKeyBase64` already handed out by `BackupController.syncBridge`
  (`GET /backup/sync/bridge`) — no new REST endpoint was added for this. It should query Drive
  by file name only (`name = 'offline-bundle.json.enc' and trashed = false`, no parent-folder
  id needed — `drive.file` OAuth scope already limits visibility to this app's own files).

## Change Index (this section only — see bootstrap/FLOWS.md for the export job itself)
| Want to change | Where |
|---|---|
| Bundle file name / Drive `kind` tag | `BundleExportService.BUNDLE_FILE_NAME` / `BUNDLE_KIND` (bootstrap) |
| Find-or-replace-one-file Drive mechanics | `DriveService.uploadOrReplace()` |
| Encryption scheme | `EncryptionService.encrypt()` (shared with the mailbox path — do not fork) |
