# resourceRepository FLOWS

Files: app.py, blueprints/friends_files.py, blueprints/groups_files.py, blueprints/connections_files.py, blueprints/backup.py, backup_scheduler.py, restore.py

---

## Routing Layer (nginx)

All browser calls hit nginx first:

- `POST /api/friend/files/upload` → nginx strips `/api/friend/` prefix → Flask receives `POST /upload`
- `POST /api/friend/files/delete` → Flask receives `POST /delete`
- `GET /api/fileRepository/file/<id>/<filename>` → nginx strips `/api/fileRepository/` prefix → Flask receives `GET /file/<id>/<filename>`
- Groups: `POST /api/groups/…` and connections: `POST /api/connections/…` are pass-through (no prefix strip)

nginx upstream: `fileRepository:5000`; body size limit: `client_max_body_size 100M`

To change the upstream host: `nginx.conf` → `upstream media_service`

---

## File Upload Flow

### From fileUpload page (friends only)

`DragDropHandler.handleDrop()` or `<input>` change → `FileUploader.addFiles()` → `FileValidator.validateFile()` (max 10 files, max 50 MB each, no duplicates by name+size) → `FileCollection.addFile()` → user clicks Upload → `FileUploader.uploadFiles()` → `UploadController.upload()` → `FormData` with key `files` + key `friendId` (extracted from `window.location.pathname` last segment) → `POST /api/friend/files/upload`

To change max file count: `FileValidator` constructor `maxFiles`
To change max file size: `FileValidator` constructor `maxFileSize`
To change upload endpoint: `UploadController.upload()`

### From profile page (mediaUpload.js)

`MediaUpload.redirectToUpload()` → redirects browser to `/fileUpload/<friendId>` (hands off to the fileUpload page flow above)

### Flask — friends blueprint

`POST /upload` → `upload_files_friend()` → validates `friendId` in form, `files` in request.files → `save_files_transactional(files, 'friends', entity_id)`

### Flask — groups blueprint (url_prefix `/groups`)

`POST /groups/upload` → `upload_files_group()` → validates `groupId` → `save_files_transactional(files, 'groups', entity_id)`

### Flask — connections blueprint (url_prefix `/connections`)

`POST /connections/upload` → `upload_files_connection()` → validates `connectionId` → `save_files_transactional(files, 'connections', entity_id)`

### `save_files_transactional()` (app.py)

`get_destination_folder(entity_type, entity_id, filename)` — classifies by extension:
- `.jpg/.jpeg/.png/.gif/.bmp` → `photos/<entity_id>/`
- `.mp4/.mov/.avi/.mkv/.webm` → `videos/<entity_id>/`
- `.mp3/.wav/.ogg/.m4a` → `voice/<entity_id>/`
- everything else → `personalResources/<entity_id>/`

Path: `RESOURCE_FOLDERS[entity_type][category]/<entity_id>/<filename>`

On success: all files saved → `201 {message, files[]}`. On failure mid-save: rolls back already-saved files via `os.remove()`.

To change root storage paths: `RESOURCE_FOLDERS` dict in `app.py`
To add a new extension category: `get_destination_folder()` if/elif chain
To add a new entity type: `RESOURCE_FOLDERS` + new blueprint + register in `app.py`

---

## File Retrieval / Streaming Flow

`GET /api/fileRepository/file/<friend_id>/<filename>` → nginx → Flask `GET /file/<friend_id>/<filename>` → `serve_file_friend()` → `find_file_path('friends', friend_id, safe_filename)` → `get_destination_folder()` to locate category folder → `os.path.isfile()` check → `send_file(path)` (streamed by werkzeug)

Groups: `GET /groups/file/<group_id>/<filename>` → `serve_file_group()`
Connections: `GET /connections/file/<connection_id>/<filename>` → `serve_file_connection()`

Primary photo URL constructed by client (primaryPhoto.js): `/api/fileRepository/file/<friendId>/<filename>`

To change serving behaviour (headers, ranges): `send_file()` call in each blueprint's `serve_file_*` function

---

## Deletion Flow

### From profile page (mediaDeletion.js)

`MediaDeletion.deleteCurrentMedia()` → confirm dialog → `performDeletion(mediaData)` → `FormData` with `photos`, `videos`, `resources` (arrays, only one populated), `friendId` → `POST /api/friend/files/delete`

Note: JS sends FormData but Flask `friends_files.delete_files_friend()` reads `request.get_json()` — only `fileNames` list + `friendId` JSON body is accepted. `MediaDeletion.performDeletion()` uses FormData which will be parsed as form, not JSON; this is a mismatch — `request.get_json()` will return `None` and the endpoint will return 400.

To change delete request format: `MediaDeletion.performDeletion()` (client) and `delete_files_friend()` (server)

### Flask — delete

`POST /delete` → `delete_files_friend()` → `request.get_json()` → validates `fileNames` list + `friendId` → `delete_files_transactional(file_names, 'friends', entity_id)`

### `delete_files_transactional()` (app.py)

For each filename: `find_file_path()` to locate → reads full file content into memory → `os.remove()`. On failure mid-delete: restores all already-deleted files from in-memory content. Returns `200 {message}` on success.

To change rollback strategy: `delete_files_transactional()` in `app.py`

After deletion: `MediaDeletion.removeFromDOM()` → CSS fade animation → `GalleryManager.updateState()` → shows empty placeholder if no media remain → `Pagination.updateAfterDeletion()` (if available)

---

## Primary Photo Flow

`PrimaryPhoto.checkIfPrimary()` → `GET /api/friend/<friendId>/primary-photo` → renders button state
`PrimaryPhoto.setCurrent()` → `POST /api/friend/set-primary-photo` with `FormData {friendId, photoId}` → on success: `PrimaryPhoto.updateProfileHeaderImage()` sets `.profile-header img` src to `/api/fileRepository/file/<friendId>/<filename>`

Note: these endpoints are handled by `communicator-core`, not resourceRepository.

---

## Backup Flow

### Manual backup (backup.py)

`GET /backup` → `backup_all_files()` → walks all paths in `RESOURCE_FOLDERS` → writes ZIP to `io.BytesIO` in-memory → streams as `file_resources_backup_<date>.zip`

### Scheduled backup (backup_scheduler.py)

`app.py` → `start_backup_scheduler()` → `BackgroundScheduler` (APScheduler):
- `run_postgres_backup()`: every 24h, first run 2min after startup → `pg_dump` → `gzip -9` → `_upload_to_drive()` → local file deleted
- `run_files_backup()`: every 24h, first run 2min after startup → ZIP all files under `BACKUP_RESOURCE_FOLDERS` → `_upload_to_drive()` → local file deleted

`_upload_to_drive()`: reads `service-account-key.json` → Google Drive API v3 → uploads to `DRIVE_FOLDER_ID`

Postgres env vars: `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_HOST`
To change backup interval: `scheduler.add_job()` calls in `start_backup_scheduler()`
To change Drive destination folder: `DRIVE_FOLDER_ID` constant in `backup_scheduler.py`
To change Google credentials path: `CREDENTIALS_PATH` in `backup_scheduler.py`
Local backup staging: `BACKUP_DIR = /app/backups`

---

## Restore Flow (restore.py — run manually)

`authenticate()` (service account) → `get_latest_backup(service)` (Drive folder query, sort desc by name) → `download_file()` → `extract_zip()` → finds `.sql` file → `restore_postgres()` (psycopg2, executes SQL dump)

Note: restore.py has placeholder values for `DRIVE_FOLDER_ID`, `PG_HOST`, `PG_USER`, `PG_PASSWORD`, `PG_DATABASE` — must be configured before use.

File-only restores: extract the ZIP from Drive manually; no automated file restore script exists [NOT IMPLEMENTED].

---

## Entity Type Differences

| Aspect | friends | groups | connections |
|---|---|---|---|
| Blueprint prefix | (none) | `/groups` | `/connections` |
| ID form field | `friendId` | `groupId` | `connectionId` |
| Storage root | `photos/`, `videos/`, `voice/`, `personalResources/` | `groups/photos/`, etc. | `connections/photos/`, etc. |
| JS upload UI | fileUpload page + profile page | [NOT IMPLEMENTED in JS] | [NOT IMPLEMENTED in JS] |
| JS deletion UI | mediaDeletion.js | [NOT IMPLEMENTED in JS] | [NOT IMPLEMENTED in JS] |

---

## Change Index

| Behaviour | Touch point |
|---|---|
| Max upload file count | `FileValidator` constructor `maxFiles` |
| Max upload file size | `FileValidator` constructor `maxFileSize` |
| Upload HTTP endpoint (friends) | `UploadController.upload()` → `POST /api/friend/files/upload` → `upload_files_friend()` |
| Upload HTTP endpoint (groups) | `POST /groups/upload` → `upload_files_group()` |
| Upload HTTP endpoint (connections) | `POST /connections/upload` → `upload_files_connection()` |
| File type → category routing | `get_destination_folder()` in `app.py` |
| Storage root paths | `RESOURCE_FOLDERS` in `app.py` and `BACKUP_RESOURCE_FOLDERS` in `backup_scheduler.py` |
| File serve endpoint | `serve_file_*()` in each blueprint |
| Delete request format (client) | `MediaDeletion.performDeletion()` |
| Delete request format (server) | `delete_files_friend/group/connection()` → `request.get_json()` |
| Transactional save logic | `save_files_transactional()` in `app.py` |
| Transactional delete + rollback | `delete_files_transactional()` in `app.py` |
| Backup schedule interval | `scheduler.add_job()` in `start_backup_scheduler()` |
| Backup Drive folder | `DRIVE_FOLDER_ID` in `backup_scheduler.py` |
| Backup Drive credentials | `CREDENTIALS_PATH` / `service-account-key.json` |
| Postgres backup env vars | `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_HOST` |
| Manual backup endpoint | `backup_all_files()` in `blueprints/backup.py` |
| nginx body size limit | `client_max_body_size` in `nginx.conf` |
| nginx upstream host | `upstream media_service` in `nginx.conf` |
| Primary photo endpoints | `communicator-core` service (not resourceRepository) |
