# Flow: Friend Bin (soft delete → restore or 7-day purge)

Files: FriendService.java (deleteFriendById/restoreFriendById/getDeletedFriends), BinPurgeService.java, FriendController.java (`/deleteFriend/{id}`, `/restoreFriend/{id}`, `/deletedFriends`), ../FriendEntities/Friend.java (`deletedAt`), ../FriendRepositories/FriendRepository.java, ../FriendEntities/FriendKnowledgeReview.java, ../../../../../../meeting/src/main/java/com/communicator/meeting/entities/{Meeting,MeetingAttendee}.java (`@OnDelete`)

Frontend: react/src/services/api/friendService.ts (`removeFriend`/`restoreFriend`/`getDeletedFriends`), react/src/components/pages/{ProfilePage,BinPage}. See [react PROTO.md](../../../../../../../frontend/react/src/PROTO.md)'s route map and Change Index.

e2e: e2e/tests/offline-outbox.spec.ts's `afterEach` cleanup uses this same `deleteFriend` endpoint by name (not id) so cleanup survives a test failing partway through — see that file's `createdFriendNames` comment.

---

## Why this exists, not a plain hard delete

`FriendController.deleteFriend` used to call `friendRepository.deleteById()` directly. That 500'd for any friend with `meeting`/`meeting_attendee`/`friend_knowledge_review` rows — those three tables live outside the `friend` module (mostly in `meeting`) so `Friend` has no `@OneToMany` for them and JPA's own cascade (`orphanRemoval = true`, already in place for `analytics`/`social`/`photos`/`videos`/`friend_knowledge`/`friend_permission`/`members`/`personal_resource`) never ran for them. In practice this meant: delete a friend with zero logged meetings → fine; delete one you'd ever actually talked to → 500, friend stuck forever. Found via 16 orphaned e2e-created friends that couldn't be deleted at all.

Rather than hard-delete (now safe, see cascade fix below) directly on that click, this became soft delete + a Bin, since an accidental "Delete" on a real friend with months of logged history had no undo before.

## The flow

```
DELETE /api/friend/deleteFriend/{id}
 → FriendController.deleteFriend(id)
 → FriendService.deleteFriendById(id)
     friend.deletedAt = now()  ;  save   — NOT a real delete
 → 204

GET /api/friend/friends/ui/page/*, /thisWeek, /getKnowledge (MCP), findByFlashcardsEnabledTrue, etc.
     all now query FriendRepository.findBy*AndDeletedAtIsNull / findByDeletedAtIsNull —
     a bin friend just silently stops appearing everywhere. findById() is deliberately
     UNFILTERED (restore, purge, and any cross-module "resolve friend name by id" lookup
     — e.g. from `meeting` — still need to find it while it's in the bin).

POST /api/friend/restoreFriend/{id}
 → FriendService.restoreFriendById(id)  — deletedAt = null, save. 404 (via a bool return) if
   the id doesn't exist or isn't currently deleted.

GET /api/friend/deletedFriends
 → FriendService.getDeletedFriends()  → FriendRepository.findByDeletedAtIsNotNull()
   — backs BinPage.

@Scheduled(cron = "${friend.bin.purge.cron:0 0 3 * * *}", zone="UTC")  BinPurgeService.purgeExpiredBinEntries()
 → FriendRepository.findByDeletedAtBefore(now - 7 days)
 → friendRepository.deleteAll(expired)   — a REAL delete this time, now safe (see below)
```

## The cascade fix that makes the eventual hard delete safe

`Friend`'s own `@OneToMany(cascade = CascadeType.ALL, orphanRemoval = true)` fields already cover 8 of the 11 tables with a `friend_id` FK (confirmed via Postgres `information_schema`, not just grep — see git history for the query). The 3 gap tables got Hibernate's `@OnDelete(action = OnDeleteAction.CASCADE)` on their `friend`/`meeting` `@ManyToOne` fields instead of a `Friend`-side `@OneToMany`, specifically to avoid `friend` taking a compile-time dependency on `meeting`'s entities (the reverse of the existing, intentional `meeting → friend` dependency):

- `Meeting.friend` (meeting module)
- `MeetingAttendee.friend` **and** `MeetingAttendee.meeting` (the second one matters too — deleting a friend cascades their `Meeting` rows, which would themselves orphan `meeting_attendee` rows for OTHER attendees of a shared meeting without this)
- `FriendKnowledgeReview.friend` (friend module, but never had a `List<FriendKnowledgeReview>` on `Friend` — reviews are read through DTOs, not the entity graph)

**Retrofit note:** `ddl-auto: update` (no Flyway/Liquibase in this repo) generates `ON DELETE CASCADE` for these on a **fresh** DB from the annotations alone, but does NOT reliably rewrite an already-existing FK constraint on a live DB — that had to be fixed once by hand (`ALTER TABLE ... DROP CONSTRAINT ... ADD ... ON DELETE CASCADE`) against the dev DB when this was introduced. If you ever restore an old backup/dump predating this change, re-run that ALTER manually — don't assume the annotation retroactively fixed it.

`connections`/`connections_knowledge`/`connection_permission` reference `friend1id`/`friend2id` with **no DB-level FK at all** (app-enforced only) — a purged friend can leave an orphaned `connections` row. Pre-existing gap, not introduced or closed by this feature; out of scope here.

## Technology Notes

- **Purge is a hard delete with no further undo.** 7 days is not configurable from the UI — it's the `RETENTION_DAYS` constant in `BinPurgeService`. Changing it only affects friends deleted after the change (the cutoff is computed at purge time, not stored per-row).
- **The purge cron (`friend.bin.purge.cron`) defaults to 03:00 UTC daily**, same pattern as `BackupScheduler`. No manual "empty bin now" endpoint exists — deliberately out of scope for the first cut (see conversation this was built in); add one if that's actually needed.
- **`findById` is intentionally unfiltered** — every other read narrows to `deletedAt IS NULL`. If you add a new "list friends" query, filter it too, or it'll surface bin contents somewhere they shouldn't be.
- **A friend in the bin still gets excluded from the nightly FSRS jobs** (`FsrsNeglectService`, `FsrsBackfillService` — both switched from `findAll()` to `findByDeletedAtIsNull()`), so a bin friend doesn't accrue neglect lapses or get backfilled while awaiting purge/restore.

## Change Index

| Want to change… | Where |
|---|---|
| Retention window (7 days) | `BinPurgeService.RETENTION_DAYS` (Java) + `BinPage.RETENTION_DAYS` (frontend, display-only — keep in sync) |
| Purge schedule | `friend.bin.purge.cron` (`application.yml`, falls back to `BinPurgeService`'s `0 0 3 * * *` default) |
| What "delete" does (soft vs hard) | `FriendService.deleteFriendById()` |
| Which list/search queries exclude the bin | `FriendRepository` — every method except `findById` |
| Add a new friend-referencing entity/table | Add `@OnDelete(action = OnDeleteAction.CASCADE)` on its `Friend` `@ManyToOne` (if outside the `friend` module) OR add it to `Friend`'s own `@OneToMany(orphanRemoval = true)` list (if inside) — otherwise purge will 500 on it exactly like `meeting` used to |
| Bin UI / restore button | `frontend/react/src/components/pages/BinPage`, `components/pages/ProfilePage` (delete button) |
