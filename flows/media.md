# Flow: Media Upload & Serve (photos / videos / voice / files)

Attach photos, videos, voice notes and documents to a friend (or group). The twist: **bytes and metadata live in different stores with no transaction between them.** **UI → nginx → friend/group → fileRepository (bytes)** + **→ Postgres (metadata)**.

Protos: [resourceRepository](../resourceRepository/flask-template/PROTO.md) · [friend](../friend/src/main/java/communicate/Friend/PROTO.md) · [nginx spine](../nginx/PROTO.md)

---

## Upload

```
User picks files on the fileUpload page (legacy MPA)  →  multipart POST
 → nginx /api/fileRepository/  (client_max_body_size 100M, buffering off)  ─► fileRepository:5000
     blueprints/friends_files.upload_files_friend(friendId, files)
       get_destination_folder(): route by EXTENSION → photos|videos|voice|personal
       save_files_transactional(): 409 if exists → mkdirs → save (rollback deletes partials)
       bytes land in volume  file-repo-<type>  at  /app/<type>/<friendId>/<filename>
 (separately) friend service writes a Photos/Videos/PersonalResource METADATA row → Postgres
```

Serve: `GET /api/fileRepository/file/<friendId>/<filename>` → `send_file` from disk. Group media is the identical flow via `groups_bp` (entity_type=`groups`).

---

## The two-store hazard (the thing to understand)

```
   friend service (Spring)                 fileRepository (Flask)
   ─ Photos/Videos row in Postgres ─┐   ┌─ actual file bytes on a docker volume
                                    │   │
                     NO shared transaction, NO FK
```

- A failure between the two calls → **orphan** (DB row without a file, or file without a row).
- **Deleting a friend cascades the DB rows** (friend proto: `CascadeType.ALL`) but **does NOT delete the disk bytes** → orphaned files accumulate forever.
- The destination folder is derived from **file extension**, so a renamed extension can put a "video" in `personal/` and desync the two views.

**Achieves:** per-friend media galleries (the profile page pulls them via `PaginationLogicService` + `FileMetaDataReadService`). **Backed up nightly** by the [backup flow](backup.md) (`FileBackupService` pulls a zip from `/backup`).

## Change Index (flow-level)

| Want to change | Where |
|---|---|
| Extension → folder routing | `resourceRepository app.py get_destination_folder()` |
| Upload dedupe / rollback | `app.py save_files_transactional()` |
| Per-entity routes | `resourceRepository blueprints/<entity>_files.py` |
| Metadata rows | friend `FileWriteService` / `Photos`,`Videos`,`PersonalResource` entities |
| Orphan cleanup (unimplemented) | add a delete-bytes call to friend's delete cascade |
| Max upload size | `nginx/nginx.conf client_max_body_size` |
