# Connections Service — Proto

> **Proto, not a flow.** This maps connections' internals + seams. It used to be a data-model-only stub — implemented for real 2026-07-25 (CODE_REUSE_REPORT.md §2).

Files: Connection.java, ConnectionId.java, ConnectionsKnowledge.java, ConnectionPermission.java, ConnectionRepository.java, ConnectionsKnowledgeRepository.java, ConnectionPermissionRepository.java, ConnectionService.java, ConnectionKnowledgeService.java, ConnectionPermissionService.java, ConnectionsController.java, ConnectionsPermissionController.java

## Role

Models a **pairwise relationship link between two friends** — "how do these two people know each other," with the same knowledge/permission tracking friend/group have, except the owner is an unordered *pair* of friend ids instead of a single one. Runs inside the `communicator-app` monolith (see [bootstrap FLOWS](../../../../../../bootstrap/FLOWS.md)), reached via nginx `/api/connections/` → `PathPrefixConfig`'s `/api/connections` prefix on the `coommunicator.connections` base package.

## Internal wiring

```
Connection (@EmbeddedId ConnectionId{friend1Id, friend2Id})
  ConnectionService.idFor(a,b) = new ConnectionId(min(a,b), max(a,b))   ← EVERY lookup/create/delete normalizes through this
  create(a,b,desc): reject a==b, reject existsById, save
  getAll() / getByFriendId(id) / getById(a,b) / deleteById(a,b)

ConnectionsKnowledge / ConnectionPermission extend knowledge-core's AbstractFact
  (id/date/text/priority/reviewDate/interval — see knowledge-core/PROTO.md)
  owner FK: @ManyToOne @JoinColumns({friend1_id→friend1Id, friend2_id→friend2Id}) Connection
  ConnectionKnowledgeService/ConnectionPermissionService extend AbstractFactService
    owner-scoped queries use @Query("...WHERE k.connection.id = :connectionId") —
    NOT a derived findByConnection_Id(...) method name. Spring Data's method-name
    parser doesn't reliably bind a whole @EmbeddedId as one parameter through a
    composite-FK association path; explicit JPQL was the safe choice, not tried-
    and-failed convention magic.
```

`ConnectionPermission` used to be `{id, description}` — a shape that matched nothing else in the app. Redesigned onto `AbstractFact` for parity with Knowledge (table was confirmed empty before the change, so no migration was needed — the old `description` column is just orphaned in Postgres now, harmless).

## Seams

**Inbound:**

| Caller | Entry point |
|---|---|
| React `ConnectionsPage`/`ConnectionDetailsPage`/`CreateConnectionPage` | `GET /list`, `GET /friend/{id}`, `GET /{f1}/{f2}`, `POST /create`, `DELETE /{f1}/{f2}` (`ConnectionsController`) |
| React `KnowledgeCrudPanel` (reused from Group) | `POST /addKnowledge/{f1}/{f2}`, `GET /getKnowledge/{f1}/{f2}`, `PUT /updateKnowledge`, `DELETE /deleteKnowledge/{id}` |
| React `KnowledgeCrudPanel` (permission) | same shape under `/permission/**` (`ConnectionsPermissionController`) |

**Outbound:** none — Postgres only, same DB as friend/group. `friend1Id`/`friend2Id` are bare Longs with a real DB-level FK to `friend(id)` (unlike `GroupMember`'s loose coupling) since `Connection`'s embedded id columns are the FK target.

## Gotchas / Technology Notes

- **Friend id type mismatch:** `Friend.id` is `Integer` everywhere else in the app; `ConnectionId.friend1Id/friend2Id` are `Long` (pre-existing, not changed here). Harmless in practice (both serialize as JSON numbers) but don't assume you can pass one type where the other is expected in Java code.
- **Order-independence is a convention, not a DB guarantee.** The unique constraint on `(friend1_id, friend2_id)` only prevents duplicates if every write path normalizes through `ConnectionService.idFor()` first. A raw SQL insert or a future direct-repository call that skips this could create a duplicate `(B,A)` row alongside `(A,B)`.
- **No frontend edit-in-place for the connection's own `description`** — only knowledge/permission items are editable after creation. Changing the description requires delete+recreate. `[NOT IMPLEMENTED]`
- **Cascade delete confirmed live:** deleting a Connection cascades to its `ConnectionsKnowledge`/`ConnectionPermission` rows (`orphanRemoval=true`) — verified via curl (create → add knowledge+permission → delete connection → both child tables empty).

## Change Index

| Thing to change | Where |
|---|---|
| Pair normalization | `ConnectionService.idFor()` (and the mirrored private copies in `ConnectionKnowledgeService`/`ConnectionPermissionService` — not shared, only 3 lines each) |
| Connection CRUD | `ConnectionService` / `ConnectionsController` |
| Knowledge/Permission CRUD | `ConnectionKnowledgeService`/`ConnectionPermissionService` (extend `AbstractFactService` — see knowledge-core/PROTO.md for what's inherited) |
| Owner-scoped queries | `ConnectionsKnowledgeRepository`/`ConnectionPermissionRepository` `@Query` methods |
| Public path prefix | `nginx/nginx.conf` `location /api/connections/` + `PathPrefixConfig` |
| Frontend | `react/src/components/pages/Connections*Page`, `services/api/connectionService.ts`, `types/api.ts` (`Connection`/`ConnectionId`) |
