# Group Domain Flows

Files: GroupApiController.java, GroupWebController.java, GroupFileController.java, GroupSocialController.java, GroupPermissionController.java, SocialGroupService.java, GroupKnowledgeService.java, GroupPermissionService.java, GroupFileService.java, GroupSocialService.java, SocialGroup.java, GroupKnowledge.java, GroupPermission.java, GroupSocial.java, GroupPhoto.java, GroupVideo.java, GroupResource.java, SocialGroupRepository.java, GroupKnowledgeRepository.java, GroupPermissionRepository.java, GroupPhotoRepository.java, GroupVideoRepository.java, GroupResourceRepository.java, GroupSocialRepository.java, groupKnowledge.js, groupDetails.js, groupsView.js, createGroup.js, knowledgeManager.js (shared)

---

## 1. Create Group

`createGroup.js.submitGroupForm()` → `POST /api/groups/create` → `GroupApiController.createGroup()` → `SocialGroupService.createGroup()` → `SocialGroupRepository.save()` → 201 + `{success, group}`

To change default group fields: `SocialGroup` entity fields.
To change validation (name 2–100 chars, no `<>"'&`): `createGroup.js.validateName()`.

---

## 2. List All Groups

`groupsView.js` (page load, server-rendered) → `GET /api/groups/` → `GroupWebController.getAllGroups()` → `SocialGroupService.getAllGroups()` → `SocialGroupRepository.findAll()` + `GroupKnowledgeService.getKnowledgeCountsForGroups()` + `GroupPermissionService.getPermissionCountsForGroups()` → Thymeleaf view `groups/allGroups`

To change sort order: `SocialGroupRepository.findAll()` (no sort currently applied).
To change which counts appear in the list view: `GroupWebController.getAllGroups()`.

---

## 3. Get Group Details (JSON)

`groupDetails.js.loadGroupDetails()` → `GET /api/groups/{id}` → `GroupApiController.getGroupDetails()` → `SocialGroupService.getGroupById()` → `SocialGroupRepository.findById()` → `{success, group}`

Note: `SocialGroup` response includes `socials` list (`@JsonManagedReference`) but `permissions` and knowledge are NOT embedded — fetched via separate calls.

---

## 4. Delete Group

`groupsView.js.deleteGroup()` → `DELETE /api/groups/{id}` → `GroupApiController.deleteGroup()` → `SocialGroupService.deleteGroup()` → `SocialGroupRepository.deleteById()`

Cascade: `SocialGroup.permissions` (`CascadeType.ALL`, `orphanRemoval=true`) and `SocialGroup.socials` (`CascadeType.ALL`, `orphanRemoval=true`) are deleted by JPA. `GroupKnowledge`, `GroupPhoto`, `GroupVideo`, `GroupResource` are NOT declared as cascaded collections on `SocialGroup` — they hold a FK `group_id` but deletion behaviour depends on DB-level cascade or orphan handling.
To change cascade behaviour: `SocialGroup` `@OneToMany` annotations.

---

## 5. Group Knowledge — Add (Batch)

### Via groupKnowledge page (shared KnowledgeManager)
`knowledgeManager.js.handleSubmitInfo()` → `POST /api/groups/addKnowledge/{groupId}` (body: `[{fact, importance}]`) → `GroupApiController.addKnowledgeToGroup()` → validates group exists via `SocialGroupService.getGroupById()` → sets default `priority=5` if null, enforces non-empty `text` → `GroupKnowledgeService.addKnowledgeToGroup()` → sets `date=today`, `reviewDate=today+1`, `interval=1` → `GroupKnowledgeRepository.saveAll()` → 201 + `{message, ids}`

JSON field mapping: `text` field is serialised as `"fact"` (`@JsonProperty("fact")`); `priority` field is serialised as `"importance"` (`@JsonProperty("importance")`).
To change default review schedule: `GroupKnowledgeService.addKnowledgeToGroup()`.
To change page size for knowledge pagination: `GroupApiController.getGroupKnowledgePage()` (hardcoded `10`) and `knowledgeManager.js` config `pageSize`.

### Via groupDetails page (legacy inline form)
`groupDetails.js.addKnowledge()` → `POST /api/groups/addKnowledge/{groupId}` (body: `[{text, priority:1}]`) → same backend path as above.

---

## 6. Group Knowledge — Paginated Read

`knowledgeManager.js.loadKnowledgePage(page)` → `GET /api/groups/getKnowledge/{groupId}/page/{page}` (0-indexed) → `GroupApiController.getGroupKnowledgePage()` → `GroupKnowledgeService.getGroupKnowledgePage()` → `GroupKnowledgeRepository.findByGroupId(pageable)` sorted DESC by `priority` → `Page<GroupKnowledge>`

To change sort field: `GroupKnowledgeService.getGroupKnowledgePage()` (`Sort.by(DESC, "priority")`).

---

## 7. Group Knowledge — Update

`knowledgeManager.js.handleUpdate()` → `PUT /api/groups/updateKnowledge` (body: `{id, fact, importance}`) → `GroupApiController.updateKnowledge()` → `GroupKnowledgeService.getKnowledgeById()` (verify exists, copy group ref) → `GroupKnowledgeService.updateKnowledge()` → updates only `text` and `priority`, preserves `date`/`reviewDate`/`interval` → `GroupKnowledgeRepository.save()` → 204

To change which fields are updatable: `GroupKnowledgeService.updateKnowledge()`.

---

## 8. Group Knowledge — Delete

`knowledgeManager.js.handleDelete()` or `groupDetails.js.deleteKnowledge()` → `DELETE /api/groups/deleteKnowledge/{knowledgeId}` → `GroupApiController.deleteKnowledge()` → `GroupKnowledgeService.deleteKnowledge()` → `GroupKnowledgeRepository.deleteById()` → 204

---

## 9. Group Knowledge — Get All (non-paginated)

`GroupWebController.getGroupKnowledge()` (server-side, Thymeleaf) → `GroupKnowledgeService.getAllGroupKnowledge()` → `GroupKnowledgeRepository.findByGroupIdOrderByDateDesc()` → Thymeleaf view `groups/groupKnowledge`

Also exposed as JSON: `GET /api/groups/getKnowledge/{groupId}` → `GroupApiController.getAllGroupKnowledge()` → same service call.

---

## 10. Group Permission — Add (Batch)

`POST /api/groups/permission/addPermission/{groupId}` (body: `[{fact, importance}]`) → `GroupPermissionController.addPermissionToGroup()` → verify group via `SocialGroupService.getGroupById()` → set default `priority=5`, enforce non-empty `text` → `GroupPermissionService.addPermissionToGroup()` → sets `date=today`, `reviewDate=today+1`, `interval=1` → `GroupPermissionRepository.saveAll()` → 201 + `{message, ids}`

Note: No dedicated JS page found for group permissions. Likely called programmatically or from a shared component. [NOT IMPLEMENTED — no UI page confirmed]

---

## 11. Group Permission — Read / Update / Delete

`GET /api/groups/permission/getPermission/{groupId}` → `GroupPermissionController.getAllGroupPermission()` → `GroupPermissionService.getAllGroupPermission()` → `GroupPermissionRepository.findByGroupIdOrderByDateDesc()`

`GET /api/groups/permission/getPermission/{groupId}/page/{page}` → paginated, sorted DESC by `priority`, page size 10.

`PUT /api/groups/permission/updatePermission` → `GroupPermissionController.updatePermission()` → `GroupPermissionService.updatePermission()` → updates only `text` and `priority`.

`DELETE /api/groups/permission/deletePermission/{permissionId}` → `GroupPermissionController.deletePermission()` → `GroupPermissionService.deletePermission()`.

---

## 12. File Upload (Photos / Videos / Resources)

`POST /api/groups/{groupId}/files/upload` (multipart) → `GroupFileController.uploadFiles()` → `GroupFileService.saveFiles()` → per-file:

- content-type `image/*` → `GroupPhotoRepository.saveAndFlush()` (metadata only, no blob stored)
- content-type `video/*` → `GroupVideoRepository.saveAndFlush()`
- anything else → `GroupResourceRepository.saveAndFlush()`

Then for every file: `GroupFileService.uploadFileToResourceRepository()` → `WebClient POST /groups/upload` (multipart, external resource-repository service)

To change the external file storage URL: `file.repository.service.url` property → `WebClientConfig.webClient()`.
To change MIME routing: `GroupFileService.saveFiles()` content-type checks.

---

## 13. File Delete

`POST /api/groups/files/delete` (body: `{photoIds, videoIds, resourceIds, groupId}`) → `GroupFileController.deleteFiles()` → `GroupFileService.deleteFiles()`:

1. Collect filenames from `GroupPhoto/Video/Resource` by ID.
2. `GroupFileService.deleteFilesFromResourceRepository()` → `WebClient POST /groups/delete` (JSON: `{fileNames, groupId}`) — external service.
3. `GroupPhotoRepository.deleteAllById()`, `GroupVideoRepository.deleteAllById()`, `GroupResourceRepository.deleteAllById()`.

To change external deletion endpoint: `GroupFileService.deleteFilesFromResourceRepository()`.

---

## 14. Set / Get Primary Photo

`POST /api/groups/set-primary-photo?photoId=&groupId=` → `GroupFileController.setPrimaryPhoto()` → `SocialGroupService.setPrimaryPhoto()` → `SocialGroupRepository.save()` (sets `SocialGroup.primaryPhotoId`)

`GET /api/groups/{groupId}/primary-photo` → `GroupFileController.getPrimaryPhoto()` → `SocialGroupService.getGroupById()` → returns `{primaryPhotoId}`

To change primary photo field: `SocialGroup.primaryPhotoId`.

---

## 15. Group Social Links (CRUD)

UI entry: `social.js` / `SocialAPIService` — note: `CONFIG.API_BASE_URL = '/api/friend/socials'` so the social page JS targets the **Friend** social endpoint, NOT the group social endpoint. Group socials have no dedicated JS page.

`POST /api/groups/{groupId}/socials` (body: `GroupSocial`) → `GroupSocialController.createGroupSocial()` → `GroupSocialService.createGroupSocial()` → look up group → `GroupSocialRepository.save()`

`GET /api/groups/{groupId}/socials` → `GroupSocialController.getAllGroupSocialsForGroup()` → `GroupSocialService.getAllGroupSocialsForGroup()` → `socialGroup.getSocials()` (lazy collection via `SocialGroupRepository.findById()`)

`GET /api/groups/{groupId}/socials/{socialId}` → `GroupSocialController.getGroupSocialById()` → `GroupSocialRepository.findById()`

`PUT /api/groups/{groupId}/socials/update/{socialId}` → `GroupSocialController.updateGroupSocial()` → `GroupSocialService.updateGroupSocial()` → updates `URL`, `platform`, `displayName` → `GroupSocialRepository.save()`

`DELETE /api/groups/{groupId}/socials/delete/{socialId}` → `GroupSocialController.deleteGroupSocial()` → `GroupSocialRepository.deleteById()`

---

## 16. External Service Dependencies

| Call site | Direction | Protocol | Endpoint | Purpose |
|---|---|---|---|---|
| `GroupFileService` | outbound | HTTP (WebClient) | `POST /groups/upload` | Store file bytes in resource-repository |
| `GroupFileService` | outbound | HTTP (WebClient) | `POST /groups/delete` | Remove file bytes from resource-repository |

Config property: `file.repository.service.url` (default `http://localhost:8080`) → `WebClientConfig`.

---

## Change Index

| Behaviour | Touch here |
|---|---|
| Group creation validation (name rules) | `createGroup.js.validateName()` |
| Group persistence | `SocialGroupService.createGroup()`, `SocialGroupRepository` |
| Group cascade-delete targets | `SocialGroup` `@OneToMany` annotations |
| Knowledge default review schedule (`date`, `reviewDate`, `interval`) | `GroupKnowledgeService.addKnowledgeToGroup()` |
| Knowledge default priority when null | `GroupApiController.addKnowledgeToGroup()` (sets `5`) |
| Knowledge sort order (paginated) | `GroupKnowledgeService.getGroupKnowledgePage()` (`Sort.by`) |
| Knowledge page size | `GroupApiController.getGroupKnowledgePage()` (literal `10`) |
| Knowledge JSON field names (`fact`/`importance`) | `GroupKnowledge.text` `@JsonProperty("fact")`, `GroupKnowledge.priority` `@JsonProperty("importance")` |
| Knowledge updatable fields | `GroupKnowledgeService.updateKnowledge()` |
| Permission default review schedule | `GroupPermissionService.addPermissionToGroup()` |
| Permission sort order (paginated) | `GroupPermissionService.getGroupPermissionPage()` (`Sort.by`) |
| Permission JSON field names | `GroupPermission.text` `@JsonProperty("fact")`, `GroupPermission.priority` `@JsonProperty("importance")` |
| Permission updatable fields | `GroupPermissionService.updatePermission()` |
| File MIME routing (image/video/other) | `GroupFileService.saveFiles()` |
| External file storage base URL | `file.repository.service.url` → `WebClientConfig.webClient()` |
| External upload endpoint path | `GroupFileService.uploadFileToResourceRepository()` |
| External delete endpoint path | `GroupFileService.deleteFilesFromResourceRepository()` |
| Primary photo field | `SocialGroup.primaryPhotoId`, `SocialGroupService.setPrimaryPhoto()` |
| Group social link fields | `GroupSocial.URL`, `GroupSocial.platform`, `GroupSocial.displayName` |
| Social link updatable fields | `GroupSocialService.updateGroupSocial()` |
| Group list counts (knowledge, permission) | `GroupWebController.getAllGroups()` |
| Shared knowledge UI (pagination, submit, update, delete) | `knowledgeManager.js` (`KnowledgeManager`) |
| Group knowledge page URL pattern (`/api/groups/{id}/knowledge`) | `GroupWebController.getGroupKnowledge()`, `knowledgeManager.js.initializeEntityId()` |
