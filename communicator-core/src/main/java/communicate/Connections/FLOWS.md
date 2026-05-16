# Connections Domain Flows

Files: ConnectionsController.java, ConnectionService.java, ConnectionPermissionService.java, ConnectionKnowledgeService.java, Connection.java, ConnectionId.java, ConnectionsKnowledge.java, ConnectionPermission.java, ConnectionRepository.java, ConnectionsKnowledgeRepository.java, ConnectionPermissionRepository.java, knowledgeManager.js (shared, nginx/static/shared/)

---

## Implementation Status

All three service classes (`ConnectionService`, `ConnectionPermissionService`, `ConnectionKnowledgeService`) and `ConnectionsController` are **stub shells with no implemented methods**. The entity model and repositories exist and are complete; the HTTP layer and business logic are [NOT IMPLEMENTED].

---

## Data Model

### Connection (composite PK)
`Connection` uses `@EmbeddedId ConnectionId` composed of `friend1Id` (Long) + `friend2Id` (Long).
Key invariant: `friend1Id = min(a,b)`, `friend2Id = max(a,b)` — enforced in `Connection(Long, Long)` constructor and by a `@UniqueConstraint`.
A `Connection` carries a `description` string and owns two child collections:
- `List<ConnectionsKnowledge>` (`CascadeType.ALL`, `orphanRemoval=true`)
- `List<ConnectionPermission>` (`CascadeType.ALL`, `orphanRemoval=true`)

To change the canonical ordering of friend IDs in the key: `Connection(Long, Long)` constructor.
To change uniqueness enforcement: `@UniqueConstraint(columnNames={"friend1_id","friend2_id"})` on `Connection`.

### ConnectionsKnowledge
Fields: `id`, `date`, `text` (`@JsonProperty("fact")`), `priority` (`@JsonProperty("importance")`), `reviewDate`, `interval`.
FK: composite join to `Connection` via `friend1_id` / `friend2_id`.

### ConnectionPermission
Fields: `id`, `description` (`@Lob`).
FK: composite join to `Connection` via `friend1_id` / `friend2_id`.
Note: unlike `ConnectionsKnowledge`, `ConnectionPermission` has no `priority`, `date`, `reviewDate`, or `interval` fields — only a single `description` blob.

---

## Planned Flows [NOT IMPLEMENTED]

The following flows are structurally implied by the entities and repositories but have no active controller routes or service logic.

### Create Connection [NOT IMPLEMENTED]
Expected: `POST /api/connections` (body: `{friendAId, friendBId, description}`) → `ConnectionService` → `new Connection(friendA, friendB)` (normalises IDs to min/max) → `ConnectionRepository.save()`

### Get Connection [NOT IMPLEMENTED]
Expected: `GET /api/connections/{friend1Id}/{friend2Id}` → `ConnectionService` → `ConnectionRepository.findById(new ConnectionId(min, max))`

### Delete Connection [NOT IMPLEMENTED]
Expected: `DELETE /api/connections/{friend1Id}/{friend2Id}` → `ConnectionService` → `ConnectionRepository.deleteById()` — cascade deletes all `ConnectionsKnowledge` and `ConnectionPermission` records.

### Add Connection Knowledge [NOT IMPLEMENTED]
Expected: `POST /api/connections/addKnowledge/{friend1Id}/{friend2Id}` (body: `[{fact, importance}]`) → `ConnectionKnowledgeService` → `ConnectionsKnowledgeRepository.saveAll()`
Shared UI: `knowledgeManager.js` (`KnowledgeManager`) is designed to work with any `apiBaseUrl` — it would drive this flow if configured with `apiBaseUrl: '/api/connections'` and `entityType: 'connection'`.

### Get / Update / Delete Connection Knowledge [NOT IMPLEMENTED]
Expected endpoints mirror the Group knowledge pattern:
- `GET /api/connections/getKnowledge/{connectionId}/page/{page}`
- `PUT /api/connections/updateKnowledge`
- `DELETE /api/connections/deleteKnowledge/{knowledgeId}`

### Add / Manage Connection Permission [NOT IMPLEMENTED]
Expected: CRUD on `ConnectionPermission` via `ConnectionPermissionService` and `ConnectionPermissionRepository`.
Note: `ConnectionPermission` schema differs from `GroupPermission` — it has only `description` (no `priority`/`interval`/`reviewDate`), so any permission UI would need a different form.

---

## UI Entry Points (partial)

`nginx/static/mainPage/index.js` renders a dropdown link `href="/api/connections/${friend.id}"` per friend — this is the only confirmed UI reference to a connections route. The route target is [NOT IMPLEMENTED] in the backend.

`knowledgeManager.js` (shared) supports both `group` and non-group entity types via config. It is used by `groupKnowledge.js` today; a connections knowledge page could use it with `entityType: 'connection'` and matching `apiBaseUrl`.

---

## Permission / Access Control [NOT IMPLEMENTED]

`ConnectionPermissionService` is a stub. No access-control logic exists. No route-level authentication or ownership check is present in `ConnectionsController`.

To add connection ownership validation: `ConnectionPermissionService.hasPermission()` (method does not yet exist — this is the intended location per class name).

---

## Cross-Service Dependencies

None currently active (all service methods are stubs). When implemented, connection creation will likely need to verify both friend IDs exist — expected call: `FriendService` or `FriendRepository` lookup.

---

## Change Index

| Behaviour | Touch here |
|---|---|
| Connection composite PK ordering (min/max) | `Connection(Long, Long)` constructor |
| Connection uniqueness constraint | `@UniqueConstraint` on `Connection` |
| Connection cascade-delete of knowledge and permission | `Connection` `@OneToMany` annotations (`CascadeType.ALL`, `orphanRemoval=true`) |
| Connection knowledge fields | `ConnectionsKnowledge` entity fields |
| Connection knowledge JSON names (`fact`/`importance`) | `ConnectionsKnowledge.text` `@JsonProperty("fact")`, `ConnectionsKnowledge.priority` `@JsonProperty("importance")` |
| Connection permission fields | `ConnectionPermission.description` |
| Connection CRUD logic | `ConnectionService` (stub — implement here) |
| Connection knowledge CRUD logic | `ConnectionKnowledgeService` (stub — implement here) |
| Connection permission / access control logic | `ConnectionPermissionService` (stub — implement here) |
| HTTP routes for all connection operations | `ConnectionsController` (stub — implement here) |
| Connection knowledge repository queries | `ConnectionsKnowledgeRepository` (extend `JpaRepository<ConnectionsKnowledge, Integer>`) |
| Connection permission repository queries | `ConnectionPermissionRepository` (extend `JpaRepository<ConnectionPermission, Integer>`) |
| Shared knowledge UI (reusable for connections) | `knowledgeManager.js` (`KnowledgeManager`, configure `apiBaseUrl`/`entityType`) |
| UI link to connections page | `mainPage/index.js` (href `/api/connections/${friend.id}`) |
