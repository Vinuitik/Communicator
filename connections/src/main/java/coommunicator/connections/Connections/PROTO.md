# Connections Service — Proto  `[SKELETON / NOT IMPLEMENTED]`

> **Proto, not a flow.** And there are no flows through this service yet — it's a data-model stub. Documented so a future session doesn't mistake the nginx route for a working feature.

Files: Connection.java, ConnectionId.java, ConnectionsKnowledge.java, ConnectionPermission.java, ConnectionRepository.java, ConnectionsKnowledgeRepository.java, ConnectionPermissionRepository.java · **ConnectionsController.java (EMPTY), ConnectionService.java (EMPTY), ConnectionKnowledgeService.java (EMPTY), ConnectionPermissionService.java (EMPTY)**

## Role (intended)

Model **bidirectional relationships between two friends** ("friend A knows friend B, here's context"). Runs on internal port **8088** (container `connectionService`), nginx route `/api/connections/`.

## What actually exists

- **Data model only.** `Connection` uses an `@EmbeddedId ConnectionId(friend1Id, friend2Id)` — the constructor `new ConnectionId(min(a,b), max(a,b))` **normalizes the pair order** so (A,B) and (B,A) are the same row; a unique constraint on `(friend1_id, friend2_id)` enforces it. Child rows `ConnectionsKnowledge` + `ConnectionPermission` mirror the friend/group knowledge+permission pattern.
- **JPA repositories** exist (`ConnectionRepository extends JpaRepository<Connection, ConnectionId>`, etc.) so Hibernate WILL create the `connections` tables in the shared DB on boot.
- **Every controller and service class is an empty shell** — no `@RequestMapping`, no methods. So the container starts, the tables exist, but **`/api/connections/*` has no handlers → 404**.

## Seams

- **Inbound:** nginx `/api/connections/` → `connectionService:8088` — currently dead (no endpoints). No UI wired.
- **Outbound:** none. Shares Postgres `my_database` (tables auto-created, never written to by app code).
- **Implicit coupling:** `friend1Id`/`friend2Id` are bare Longs referencing friend IDs — no FK, same cross-service loose coupling as `GroupMember`.

## To implement

Copy the friend/group knowledge+permission stack into the empty `ConnectionService` / `ConnectionKnowledgeService` / `ConnectionsController` (this is a prime shared-library candidate — see the code-reuse report). Then wire real endpoints and a UI. Until then, treat any "connection" pipeline as **aspirational**.

## Change Index

| Thing | Where |
|---|---|
| Composite-key pair normalization | `Connection(Long,Long)` ctor → `ConnectionId` |
| Uniqueness of a friend pair | `@Table uniqueConstraints` on `Connection` |
| Implement CRUD | fill `ConnectionsController` + `ConnectionService` (copy friend pattern) |
| Public path prefix | `nginx/nginx.conf` `location /api/connections/` |
