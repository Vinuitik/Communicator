# Resource Repository (fileRepository) — Proto

> **Proto, not a flow.** Media-upload and backup pipelines that pass through here live in [flows/](../../flows/).

Files: app.py, blueprints/friends_files.py, blueprints/groups_files.py, blueprints/connections_files.py, blueprints/backup.py

## Role

The **binary blob store**. Flask app, internal port **5000** (container `fileRepository`), nginx route `/api/fileRepository/`. Holds the actual **file bytes** on disk; the Spring services hold the **metadata rows** (`Photos`/`Videos`/`PersonalResource` etc.). This split is the key thing to understand (see Gotchas).

Files are stored under `/app/<bucket>/<subtype>/<entityId>/<filename>`, one directory tree per entity type, each subtype a separate docker volume (`file-repo-photos`, `-videos`, `-voice`, `-personal`, `-groups`, `-connections`).

## Internal wiring

```
app.py defines the shared engine + registers 4 blueprints:
  RESOURCE_FOLDERS[entity_type][subtype]  — friends | groups | connections  ×  photos|videos|voice|personal
  get_destination_folder(type,id,filename) — routes by EXTENSION:
     .jpg/.png/.gif/.bmp → photos   .mp4/.mov/.avi/.mkv/.webm → videos
     .mp3/.wav/.ogg/.m4a → voice    (anything else) → personal
  save_files_transactional()   — pre-checks (409 if exists) → mkdirs → save; rollback deletes partial saves on error
  delete_files_transactional() — reads bytes into memory FIRST → deletes → on failure rewrites them (poor-man's transaction)

blueprints/friends_files.py   → /upload (friendId+files), /file/<id>/<filename> (serve), /delete
blueprints/groups_files.py    → same shape, entity_type='groups'
blueprints/connections_files.py → same shape, entity_type='connections'
blueprints/backup.py          → /backup — zips all volumes for the backup service
```

## Seams

**Inbound:**

| Caller | Trigger / why | Endpoint |
|---|---|---|
| friend service | upload/serve/delete a friend's media | `POST /upload`, `GET /file/<id>/<name>`, `POST /delete` (entity `friends`) |
| group service | group media | groups blueprint (same shape) |
| connections service | connection media (unused — connections is a stub) | connections blueprint |
| React/legacy UI (via nginx) | direct media fetch/upload | `/api/fileRepository/...` |
| backup service | pull a zip of all media | `GET /backup` → `blueprints/backup.py` |

**Outbound:** none — pure disk I/O. No DB, no other service calls.

## Gotchas / Technology Notes

- **Metadata and bytes live in different stores with no transaction between them.** Spring writes a `Photos` row in Postgres; Flask writes the file on disk. A failure between the two calls leaves an orphan (row without file, or file without row). Deleting a friend cascades the DB rows (see friend proto) but **does NOT delete the disk files** — orphaned bytes accumulate.
- **Folder is derived from file EXTENSION, not declared type.** Rename `clip.mp4` → `clip.txt` and it lands in `personal/`, and `find_file_path` (which re-derives the folder from the same extension) can still find it — but if the DB stored it as a "video", the two views disagree.
- **The three blueprints are near-identical.** `friends_files.py`, `groups_files.py`, `connections_files.py` differ only in the `entity_type` string and route names. Shared-function candidate (they already share the engine in `app.py`; the blueprints could be one factory). Reuse target.
- **"Transactional" is best-effort in-process.** `delete_files_transactional` buffers file bytes in memory to roll back — a large multi-file delete holds all of it in RAM, and a crash mid-rollback logs `CRITICAL` and leaves partial state. No real atomicity across files.
- **`secure_filename` is the only sanitisation.** Entity id and filename are both run through it; there's no auth — anything on the docker network (or through nginx) can read `/file/<anyId>/<name>`.
- **No dev server hardening noted** — check the Dockerfile CMD for whether it runs Flask's dev server vs gunicorn; media uploads are capped upstream by nginx `client_max_body_size 100M`.

## Change Index

| Thing to change | Where |
|---|---|
| Extension → subtype routing | `app.py get_destination_folder()` |
| Storage root / volume layout | `app.py RESOURCE_FOLDERS` + compose `file-repo-*` volumes |
| Upload dedupe (409) behaviour | `app.py save_files_transactional()` |
| Delete rollback behaviour | `app.py delete_files_transactional()` |
| Per-entity routes | `blueprints/<entity>_files.py` |
| Backup zip contents | `blueprints/backup.py` (consumed by `FileBackupService`) |
| Public path prefix | `nginx/nginx.conf` `location /api/fileRepository/` |
| Max upload size | `nginx/nginx.conf client_max_body_size` (100M) |
