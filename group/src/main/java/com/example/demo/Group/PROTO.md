# Group Service — Proto

> **Proto, not a flow.** Internal wiring + seams for the group subsystem. Pipelines in [flows/](../../../../../../flows/).

Files: GroupApiController.java, GroupWebController.java, GroupFileController.java, GroupSocialController.java, GroupPermissionController.java, SocialGroupService.java, GroupKnowledgeService.java, GroupFileService.java, SocialGroup.java, GroupKnowledge.java

## Role

Manages **social groups** — a named bucket (`SocialGroup`: name, description, primaryPhotoId) with its own child rows mirroring the friend service: `GroupKnowledge` (facts), `GroupSocial`, `GroupPermission`, `GroupPhoto`/`GroupVideo`/`GroupResource` (media metadata). Spring Boot / Java 21 / shared Postgres. Internal port **8086** (container `groupService`), reached via nginx `/api/groups/`. Base path here is `@RequestMapping("/")` so `/api/groups/create` → `groupService:8086/create`.

**The friend↔group membership link (`GroupMember`) lives in the FRIEND service**, not here — this service owns the group and its content, friend owns the join rows. That split is a seam (see below).

---

## Internal wiring

Standard Spring 3-layer, one stack per child type:

```
GroupApiController   → SocialGroupService     → SocialGroupRepository   (SocialGroup CRUD)
                     → GroupKnowledgeService   → GroupKnowledgeRepository (facts, paginated by priority)
GroupSocialController → GroupSocialService     → GroupSocialRepository
GroupPermissionController → GroupPermissionService → GroupPermissionRepository
GroupFileController  → GroupFileService        → fileRepository (media bytes) + Group*Repository (metadata)
GroupWebController    → Thymeleaf pages (createGroup, groupDetails, groupKnowledge)  [LEGACY MPA]
```

Key endpoints (`GroupApiController`): `POST /create`, `GET /{id}`, `DELETE /{id}`, `POST /addKnowledge/{groupId}`, `GET /getKnowledge/{groupId}[/page/{page}]`, `PUT /updateKnowledge`, `DELETE /deleteKnowledge/{id}`.

`addKnowledge` guards: nulls the incoming id (force insert), defaults `priority=5L`, rejects blank text with `IllegalArgumentException`. Knowledge pagination sorts by priority DESC, size 10 — same convention as friend.

---

## Seams

**Inbound:**

| Caller | Trigger / why | Entry point |
|---|---|---|
| React UI / legacy MPA | create/view/delete group, manage group facts | `POST /create`, `GET /{id}`, `POST /addKnowledge/{groupId}`, `GET /getKnowledge/..` |
| nginx (static) | serves `createGroup.html` directly at `/api/groups/createGroup` | nginx `location =` (NOT this service) |
| AI agent / MCP | group knowledge as embeddings source | `GET /getKnowledge/{groupId}` |

**Outbound:**

| Callee | Trigger / why | Exit point |
|---|---|---|
| fileRepository | group media upload/read (`/app/groups` volume) | `GroupFileService` (WebClient) |
| Postgres (`my_database`) | persistence (same shared DB as friend/connections) | JPA repositories, `SPRING_DATASOURCE_*` |
| friend service (implicit) | `GroupMember` join rows reference `groupId` | no direct call — coupled by shared `groupId` in friend's `GroupMember` table |

---

## Gotchas / Technology Notes

- **This is a near-clone of the friend service** minus EMA/analytics/scheduling. Same controller/service/repository/entity layout, same `@CrossOrigin(origins="http://nginx")`, same knowledge-pagination-by-priority, same media-proxy-to-fileRepository pattern, same swallow-and-print error handling. Package is `com.example.demo.Group` (the Spring Initializr default was never renamed) vs friend's `communicate.Friend`. **This is the #1 code-reuse target** — see the consolidation report.
- **Split ownership of "membership."** A group's members are `GroupMember` rows in the **friend** DB tables, keyed by a bare `groupId` int with no FK to `SocialGroup`. Deleting a `SocialGroup` here does NOT cascade to those membership rows (different service, no FK) — they orphan. Reconciliation is manual/none.
- **`createGroup` returns the saved entity in JSON** including lazy collections — serialization depends on `@JsonManagedReference`/`@JsonBackReference` being set on every child, same fragility as friend.
- **`updateGroup` blindly `setId(id)` + save** — full overwrite, no field-merge, will null any field omitted from the request body (differs from friend's null-guarding merge).
- **No auth**, shared DB, Hibernate `ddl-auto` — same posture as friend/connections.

---

## Change Index

| Thing to change | Where |
|---|---|
| Group CRUD | `SocialGroupService` |
| Group knowledge default priority (5) / insert guards | `GroupApiController.addKnowledgeToGroup()` |
| Knowledge page size (10) / sort (priority DESC) | `GroupKnowledgeService.getGroupKnowledgePage()` |
| Group media backend | `GroupFileService` + env `FILE_REPOSITORY_SERVICE_URL` |
| Primary photo | `SocialGroupService.setPrimaryPhoto()` |
| Public path prefix | `nginx/nginx.conf` `location /api/groups/` |
| Static create-group page | `nginx/nginx.conf` `location = /api/groups/createGroup` + `static/createGroup/` |
| DB connection | env `SPRING_DATASOURCE_*` (compose) |
