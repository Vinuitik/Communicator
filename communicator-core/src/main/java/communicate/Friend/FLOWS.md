# Friend Domain Flows

Files: FriendController.java, FriendAnalyticsController.java, FriendKnowledgeController.java, FileController.java, SocialController.java, FriendPermissionController.java, GroupMemberController.java, FriendService.java, AnalyticsService.java, EmaUpdateService.java, FriendKnowledgeService.java, FriendPermissionService.java, FriendEventService.java, MeetingService.java, MeetingGenerationService.java, FileWriteService.java, PaginationLogicService.java, FileMetaDataReadService.java, SocialService.java, GroupMemberService.java, FriendDTO.java, ShortFriendDTO.java, MCP_Friend_DTO.java, MCP_Knowledge_DTO.java, SocialDTO.java, PaginationDTO.java, index.js, addForm.js, talkedForm.js, meeting.js, events.js, facts.js, profile.js, profileApp.js, aiChat.js, mediaUpload.js, mediaDeletion.js, primaryPhoto.js, socialLinks.js, knowledgeTable.js, knowledgeManager.js

---

## 1. Main Page — List All Friends

`index.js` DOMContentLoaded → `fetchAllFriends()` → `GET /api/friend/friends/ui/page/{page}/size/10` → `FriendController.getFriendsPaginatedForUI()` → `FriendService.getFriendsPagedForUI(page, size)` → `FriendRepository.findAll(pageable)` → returns `List<FriendDTO>`

Parallel count fetch: `GET /api/friend/friends/count` → `FriendController.getFriendsCount()` → `FriendService.getFriendsCount()` → `FriendRepository.count()`

UI renders intensity score = `averageFrequency + averageDuration + averageExcitement`, color-coded by EMA sum and `plannedSpeakingTime` urgency.

To change page size: `index.js` constant `pageSize = 10`.
To change intensity score formula: `index.js` `calculateIntensityScore()`.

---

## 2. Main Page — This Week View

`index.js` → `fetchWeekFriends()` → `GET /api/friend/thisWeek` → `FriendController.getWeekFriends()` → `FriendService.findThisWeek()` — returns friends where `dateOfBirth` (adjusted to current year) falls Mon–Sun, OR `plannedSpeakingTime <= sunday`

Birthday detection: `FriendController.getWeekFriends()` sets `isBirthdayThisWeek` flag in `FriendDTO`.

To change "this week" inclusion logic: `FriendService.findThisWeek()`, `FriendService.isBefore()`, `FriendService.isBetween()`.

---

## 3. Add Friend

`addForm.js` form submit → collects name, lastSpoken date, experience (`*`/`**`/`***`), dateOfBirth, hours, knowledge rows (from `facts.js` `collectKnowledgeData()`)

`POST /api/friend/addFriend` (body: `Friend` with embedded `analytics[]` and `knowledge[]`) → `FriendController.addFriend()`

`FriendController.addFriend()`:
1. `FriendService.setMeetingTime(experience, lastSpokenDate)` → computes `plannedSpeakingTime`: `*`=+1 day, `**`=+1 week, default=+1 month → `friend.setPlannedSpeakingTime()`
2. `FriendService.save(friend)` → `FriendRepository.save()`
3. `AnalyticsService.saveAll(friend)` → for each analytics: `AnalyticsRepository.save()` + `EmaUpdateService.updateEmaOnNewAnalytics()` (updates friend EMA in-transaction; rolls back on failure)
4. `FriendKnowledgeService.saveAll(friend.knowledge)` → `FriendKnowledgeRepository.saveAll()`

To change next-meeting scheduling formula: `FriendService.setMeetingTime()`.

---

## 4. Update Friend ("Talked To")

`talkedForm.js` form submit (uses today as date) → `PUT /api/friend/talkedToFriend/{id}` → `FriendController.updateFriend()`

`FriendController.updateFriend()`:
1. `FriendService.setMeetingTime(experience, LocalDate.now())` → new `plannedSpeakingTime`
2. `FriendService.updateFriend(id, friend)` → `FriendRepository.save()` + `flush()`
3. `AnalyticsService.saveAll(analytics, id)` → per entry: `AnalyticsRepository.save()` + `EmaUpdateService.updateEmaOnNewAnalytics()`
4. `FriendKnowledgeService.saveAll(knowledges, id)` → `FriendKnowledgeRepository.save()` per item

To change which fields get updated: `FriendService.updateFriend()`.

---

## 5. Delete Friend

`index.js` delete button → `DELETE /api/friend/deleteFriend/{id}` → `FriendController.deleteFriend()` → `FriendService.deleteFriendById(id)` → `FriendRepository.deleteById(id)`

Cascades depend on JPA cascade config on `Friend` entity.

---

## 6. Analytics Chart

`analytics.js` DOMContentLoaded → `GET /api/friend/shortList` → `FriendController.getShortList()` → `FriendService.getCompressedList()` → `FriendRepository.findAllShortFriendDTOs()` → populates friend dropdown

User applies filter → `GET /api/friend/analyticsList?friendId=&left=&right=` → `FriendAnalyticsController.getAnalyticsList()` → `AnalyticsService.getFriendDateAnalytics()` → `AnalyticsRepository.findByFriendIdAndDateBetween()`

Chart rendering done client-side in `analytics.js` `updateCharts()` using EMA with per-day alpha arrays.

---

## 7. Knowledge CRUD (Facts Page + Profile Page)

**Add knowledge (standalone facts page):**
`facts.js` / `knowledgeManager.js` → `POST /api/friend/addKnowledge/{id}` (body: `List<FriendKnowledge>`) → `FriendKnowledgeController.addKnowledge()` → sets `friend`, default `date=now`, default `priority=5`, validates `text` not empty → `FriendKnowledgeService.saveAll(knowledge)` → `FriendKnowledgeRepository.saveAll()`

**Add knowledge bundled with addFriend/updateFriend:**
Embedded in `Friend.knowledge[]` in `addFriend` / `talkedToFriend` payloads — handled in `FriendKnowledgeService.saveAll(list, friendId)`.

**Load knowledge (paginated):**
`knowledgeManager.js` `loadKnowledgePage(page)` → `GET /api/friend/getKnowledge/{friendId}/page/{page-1}` → `FriendKnowledgeController.getKnowledgePaginated()` → `FriendKnowledgeService.getKnowledgeByFriendIdPaginated(friendId, page)` → sorted DESC by `priority`, page size 10

**Update knowledge:**
`knowledgeManager.js` `handleUpdate()` → `PUT /api/friend/updateKnowledge` (body: `FriendKnowledge` with id) → `FriendKnowledgeController.updateKnowledge()` → re-fetches from DB to preserve `friend` association → `FriendKnowledgeService.updateKnowledge()` → `FriendKnowledgeRepository.save()`

**Delete knowledge:**
`knowledgeManager.js` `handleDelete()` → `DELETE /api/friend/deleteKnowledge/{id}` → `FriendKnowledgeController.deleteKnowledge()` → `FriendKnowledgeService.deleteKnowledgeById()` → `FriendKnowledgeRepository.deleteById()`

**AI agent knowledge endpoints:**
- `GET /api/friend/getKnowledgeIds/{friendId}` → all knowledge IDs for FAISS index building
- `GET /api/friend/getKnowledgeText/{id}` → full text for chunk reconstruction
- `GET /api/friend/getKnowledge/{friendId}/page/{page}/size/{size}` → `MCP_Knowledge_DTO` list (fields: `id`, `fact`, `importance`)

To change default knowledge priority: `FriendKnowledgeController.addKnowledge()` constant `5L`.
To change page size: `FriendKnowledgeService.getKnowledgeByFriendIdPaginated()` default `size=10`.
To change sort order: `FriendKnowledgeService.getKnowledgeByFriendIdPaginated()` `Sort.Direction.DESC, "priority"`.

---

## 8. Permissions CRUD

Same structure as Knowledge CRUD. Endpoints:
- `POST /api/friend/addPermission/{id}`
- `DELETE /api/friend/deletePermission/{id}`
- `PUT /api/friend/updatePermission`
- `GET /api/friend/getPermission/{friendId}/page/{page}`
- `GET /api/friend/getPermission/{friendId}` (all, sorted)
- `GET /api/friend/getPermissionById/{id}`

All route through `FriendPermissionController` → `FriendPermissionService` → `FriendPermissionRepository`.
Sorted DESC by `priority`, page size 10.

---

## 9. Events CRUD

`events.js` form submit → `POST /api/friend/friends/{friendId}/events` (body: `FriendEvent` with eventType, title, baseDate, recurrenceDays, keepMeetingDate, active, notes) → `FriendController.createFriendEvent()` → `FriendService.getFriendById()` → `FriendEventService.save()` → `FriendEventRepository.save()`

`GET /api/friend/friends/{friendId}/events` → `FriendController.getFriendEvents()` → `FriendEventService.getByFriendId()` → `FriendEventRepository.findByFriendId()`

`PUT /api/friend/friends/{friendId}/events/{eventId}` → `FriendController.updateFriendEvent()` → `FriendEventService.updateForFriend()` — patches non-null fields only

`DELETE /api/friend/friends/{friendId}/events/{eventId}` → `FriendController.deleteFriendEvent()` → `FriendEventService.deleteForFriend()`

`FriendEvent.active=false` suppresses the event in nightly meeting generation (`MeetingGenerationService.generateIfMissing()`).

To change which event fields are patchable: `FriendEventService.updateForFriend()`.

---

## 10. Meetings CRUD

`meeting.js` DOMContentLoaded → `GET /api/friend/friends/{friendId}/meetings` → `FriendController.getFriendMeetings()` → `MeetingService.getByFriendId()` → `MeetingRepository.findByFriendId()` → rendered as heatmap

`POST /api/friend/friends/{friendId}/meetings` (manual create) → `FriendController.createFriendMeeting()` — validates optional event belongs to friend → `MeetingService.save()`

`PUT /api/friend/meetings/{meetingId}` → `FriendController.updateMeeting()` → validates event ownership → `MeetingService.updateMeeting()` — patches non-null fields

`DELETE /api/friend/meetings/{meetingId}` → `FriendController.deleteMeeting()` → `MeetingService.deleteById()`

Auto-generated meetings have `source=EVENT_AUTO`, `status=PLANNED` — set by `MeetingGenerationService`.
Meetings are generated nightly by `ChronoJobService` for all active `FriendEvent` records.

---

## 11. Profile Page

`profileApp.js` `ProfileApp.init()` initializes modules in order: `MediaModal` → `MediaUpload` → `Pagination` → `KnowledgeTable` → `AiChatUI` → `AiChat`

**Media gallery pagination:**
`Pagination.init()` → `GET /api/friend/files/{friendId}/page/{pageId}` → `FileController.getFileUploadPage()` → `PaginationLogicService.getPaginationData(page, friendId)` → counts Photos/Videos/Resources per friend → allocates slots across three types (equal thirds, overflow redistributed) → `FileMetaDataReadService.getPhotosByFriendIdWithLimitOffset()` etc. → returns `PaginationDTO`

To change media page size: `app.media.page-size` property (`PaginationLogicService.pageSize`).

**Knowledge table on profile:**
`knowledgeTable.js` (module) → `KnowledgeManager` with `apiBaseUrl=/api/friend` → same flows as section 7.

**Social links:**
`socialLinks.js` `ProfileSocialManager.loadSocialLinks()` → `GET /api/friend/socials/{friendId}` → `SocialController.getFriendSocials()` → `SocialService.getSocialsByFriendId()` → `SocialRepository.findByFriendIdOrderByPlatform()`

**AI chat:**
`aiChat.js` `AiChat.connect()` → WebSocket `wss://{host}/api/ai/chat/ws` → sends `{type:"context", friendId, friendName}` on open → bi-directional chat with AI agent service. Reconnects with exponential backoff up to 5 attempts.
To change WS endpoint: `aiChat.js` `AiChat.connect()` URL construction.
To change reconnect policy: `aiChat.js` `maxReconnectAttempts=5`, `reconnectDelay=1000`.

---

## 12. Media Upload

`mediaUpload.js` / `profile.js` upload button → navigates to `/fileUpload/{friendId}`

File upload form → `POST /api/friend/files/upload` (multipart: `files[]`, `friendId`) → `FileController.uploadFiles()` → `FileWriteService.saveFiles()`

`FileWriteService.saveFiles()`:
1. Per file: `saveFileMetadata(file, friend)` — classifies by extension into `Photos`, `Videos`, or `PersonalResource` → saves to respective repository → `flush()`
2. `saveFilesToRepository(files, friend)` — `WebClient POST {fileRepositoryServiceUrl}/upload` (multipart) — external Flask/file service
   External call failure throws → `@Transactional` rolls back DB metadata

To change file classification: `FileWriteService.getFileCategory()`.
To change external file service URL: `file.repository.service.url` property (default `http://localhost:5000`).

---

## 13. Media Deletion

`profile.js` `deleteCurrentMedia()` → `POST /api/friend/files/delete` (form-data: `photos[]`, `videos[]`, `resources[]`, `friendId`) → `FileController.deleteFiles()` → `FileWriteService.deleteFiles()`

`FileWriteService.deleteFiles()`:
1. Collects filenames from `Photos/Videos/PersonalResource` repositories
2. `deleteFilesFromRepository(fileNames, friend)` → `WebClient POST {fileRepositoryServiceUrl}/delete` (JSON: `{fileNames, friendId}`)
3. `photoRepository.deleteAllById()`, `videoRepository.deleteAllById()`, `resourceRepository.deleteAllById()`

---

## 14. Primary Photo

`profile.js` / `primaryPhoto.js` → `POST /api/friend/set-primary-photo?photoId=&friendId=` → `FriendController.setPrimaryPhoto()` → `FriendService.setPrimaryPhoto()` → `friend.setPrimaryPhotoId(photoId)` → `FriendRepository.save()`

Check current: `GET /api/friend/{friendId}/primary-photo` → `FriendController.getPrimaryPhoto()` → returns `{primaryPhotoId}` from `Friend.primaryPhotoId`

---

## 15. Social Links CRUD

`socialLinks.js` → `GET /api/friend/socials/{friendId}` → `SocialController.getFriendSocials()` → `SocialService.getSocialsByFriendId()` → `SocialRepository.findByFriendIdOrderByPlatform()`

`POST /api/friend/socials/{friendId}` (body: `SocialDTO`: URL, platform, displayName) → `SocialController.createSocial()` → `SocialService.createSocial()` — validates URL format (http/https, tel:, mailto:, @handle, phone number, bare domain) → `SocialRepository.save()`

`PUT /api/friend/socials/update/{socialId}` → `SocialController.updateSocial()` → `SocialService.updateSocial()` → `SocialRepository.save()`

`DELETE /api/friend/socials/delete/{socialId}` → `SocialController.deleteSocial()` → `SocialService.deleteSocial()` → `SocialRepository.deleteById()`

To change URL validation rules: `SocialService.isValidUrl()`.

---

## 16. Group Membership

`POST /api/groupMember/addFriendToGroups` (body: `{friendId, groupIds[]}`) → `GroupMemberController.addFriendToGroups()` → `GroupMemberService.addFriendToGroups()` → per groupId: `GroupMemberRepository.save(GroupMember{groupId, friend})`

`POST /api/groupMember/addFriendsToGroup` / `addFriendsToGroups` — batch variants

`GET /api/groupMember/groups/friend/{friendId}` → `GroupMemberService.getGroupsByFriendId()` → `GroupMemberRepository.findGroupIdsByFriendId()`
`GET /api/groupMember/friends/group/{groupId}` → `GroupMemberService.getFriendsByGroupId()` → `GroupMemberRepository.findFriendsByGroupId()`

Note: `GroupMember` stores only `groupId` (Integer) — no Group entity exists in this service. Group metadata lives elsewhere.

---

## 17. Chrono-facing Endpoints (called by Chrono domain internally)

`PUT /api/friend/updateAverages` (body: `{id, averageFrequency, averageDuration, averageExcitement}`) → `FriendController.updateFriendAverages()` → `FriendService.updateMovingAverages()` → `FriendRepository.save()`

`POST /api/friend/batch-interaction-check?date=YYYY-MM-DD` (body: `List<Integer> friendIds`) → `FriendController.batchInteractionCheck()` → `AnalyticsService.getFriendsWithInteractionsOnDate()` → `AnalyticsRepository.findFriendIdsWithInteractionsOnDate()`

`GET /api/friend/friends/chrono/page/{page}/size/{size}` → `FriendController.getFriendsForChrono()` → `FriendService.getFriendsPaginatedForChrono()` → returns `List<ShortFriendDTO>` (id, name, averageFrequency, averageDuration, averageExcitement)

Note: These endpoints exist for inter-service calling but `ChronoJobService` now uses direct repository injection rather than HTTP — these may be legacy or for external callers.

---

## 18. MCP/AI-facing Endpoints

`GET /api/friend/friends/page/{page}` → `FriendController.getFriendsPaginated(page)` → `FriendService.getFriendsPaginated(page)` → page size 10, sorted by name ASC → `MCP_Friend_DTO`

`GET /api/friend/friends/page/{page}/size/{size}` → custom size variant → `List<MCP_Friend_DTO>`

`GET /api/friend/getKnowledge/{friendId}/page/{page}/size/{size}` → `List<MCP_Knowledge_DTO>` (id, fact, importance)
`GET /api/friend/getKnowledgeIds/{friendId}` → `List<Integer>` (all IDs for FAISS)
`GET /api/friend/getKnowledgeText/{id}` → `{id, text}` map

---

## Change Index

| Behaviour | Where to change |
|---|---|
| Next meeting scheduling (stars → days offset) | `FriendService.setMeetingTime()` |
| "This week" friend inclusion logic | `FriendService.findThisWeek()`, `isBefore()`, `isBetween()` |
| EMA update on new analytics | `EmaUpdateService.updateEmaOnNewAnalytics()` |
| EMA base alpha per experience | `EmaProperties.getNewDataAlpha()` (config: `ema.coefficients.new-data.*`) |
| Analytics date range query | `AnalyticsRepository.findByFriendIdAndDateBetween()` |
| Batch interaction check (chrono decay) | `AnalyticsRepository.findFriendIdsWithInteractionsOnDate()` |
| Knowledge page size | `FriendKnowledgeService.getKnowledgeByFriendIdPaginated()` default `10` |
| Knowledge sort order | `FriendKnowledgeService.getKnowledgeByFriendIdPaginated()` sort field/direction |
| Default knowledge priority | `FriendKnowledgeController.addKnowledge()` constant `5L` |
| Permission page size | `FriendPermissionService.getPermissionByFriendIdPaginated()` default `10` |
| Event recurrence → meeting generation | `MeetingGenerationService.calculateNextOccurrence()` |
| Meeting auto-generation trigger | `ChronoJobService.applyDailyDecay()` → `MeetingGenerationService.generateMissingNextMeetingsForAllFriends()` |
| Active event flag | `FriendEvent.active` field, `FriendEventRepository.findByActiveTrue()` |
| Media page size | `app.media.page-size` property → `PaginationLogicService.pageSize` |
| Media slot allocation per type | `PaginationLogicService.getMediaAllocations()` |
| External file repository URL | `file.repository.service.url` property → `FileWriteService.fileRepositoryServiceUrl` |
| File type classification | `FileWriteService.getFileCategory()` |
| Primary photo storage | `Friend.primaryPhotoId`, `FriendService.setPrimaryPhoto()` |
| Social URL validation | `SocialService.isValidUrl()` |
| AI WebSocket endpoint | `aiChat.js` `AiChat.connect()` wsUrl construction |
| AI chat reconnect policy | `aiChat.js` `maxReconnectAttempts`, `reconnectDelay` |
| Main page default page size | `index.js` constant `pageSize = 10` |
| Intensity score display formula | `index.js` `calculateIntensityScore()` |
| MCP default page size | `FriendService.getFriendsPaginated(int page)` hardcoded `10` |
