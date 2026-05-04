# Graph Report - .  (2026-05-04)

## Corpus Check
- Corpus is ~4,485 words - fits in a single context window. You may not need a graph.

## Summary
- 178 nodes · 189 edges · 26 communities detected
- Extraction: 86% EXTRACTED · 14% INFERRED · 0% AMBIGUOUS · INFERRED: 26 edges (avg confidence: 0.83)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Knowledge Service Layer|Knowledge Service Layer]]
- [[_COMMUNITY_All Groups UI|All Groups UI]]
- [[_COMMUNITY_Group List & Navigation|Group List & Navigation]]
- [[_COMMUNITY_Group API Controller|Group API Controller]]
- [[_COMMUNITY_File Request Models|File Request Models]]
- [[_COMMUNITY_File Upload & Delete|File Upload & Delete]]
- [[_COMMUNITY_Permission Controller|Permission Controller]]
- [[_COMMUNITY_Social Controller|Social Controller]]
- [[_COMMUNITY_Social Service|Social Service]]
- [[_COMMUNITY_Knowledge Repository|Knowledge Repository]]
- [[_COMMUNITY_CORS Web Config|CORS Web Config]]
- [[_COMMUNITY_Application Bootstrap|Application Bootstrap]]
- [[_COMMUNITY_WebClient Config|WebClient Config]]
- [[_COMMUNITY_Test Suite|Test Suite]]
- [[_COMMUNITY_Knowledge Entity|Knowledge Entity]]
- [[_COMMUNITY_Permission Entity|Permission Entity]]
- [[_COMMUNITY_Photo Entity|Photo Entity]]
- [[_COMMUNITY_Resource Entity|Resource Entity]]
- [[_COMMUNITY_Social Entity|Social Entity]]
- [[_COMMUNITY_Video Entity|Video Entity]]
- [[_COMMUNITY_Photo Repository|Photo Repository]]
- [[_COMMUNITY_Resource Repository|Resource Repository]]
- [[_COMMUNITY_Social Repository|Social Repository]]
- [[_COMMUNITY_Video Repository|Video Repository]]
- [[_COMMUNITY_Social Group Repository|Social Group Repository]]
- [[_COMMUNITY_Create Group Endpoint|Create Group Endpoint]]

## God Nodes (most connected - your core abstractions)
1. `Group Knowledge Tracker Page` - 13 edges
2. `Group Details Page` - 12 edges
3. `GroupKnowledgeService` - 10 edges
4. `GroupPermissionService` - 10 edges
5. `GroupApiController` - 9 edges
6. `FileDeleteRequest` - 9 edges
7. `All Groups Page` - 9 edges
8. `SocialGroupService` - 7 edges
9. `Group Row Dropdown Menu` - 7 edges
10. `GroupPermissionController` - 6 edges

## Surprising Connections (you probably didn't know these)
- `Group Row Dropdown Menu` --references--> `Group Knowledge Tracker Page`  [INFERRED]
  group/src/main/resources/templates/groups/allGroups.html → group/src/main/resources/templates/groups/groupKnowledge.html
- `Knowledge Count Display (per group)` --conceptually_related_to--> `Knowledge Domain Model`  [INFERRED]
  group/src/main/resources/templates/groups/allGroups.html → group/src/main/resources/templates/groups/groupKnowledge.html
- `Group Details Page` --references--> `All Groups Page`  [EXTRACTED]
  group/src/main/resources/templates/groups/groupDetails.html → group/src/main/resources/templates/groups/allGroups.html
- `All Groups Page` --conceptually_related_to--> `Group Knowledge Tracker Page`  [INFERRED]
  group/src/main/resources/templates/groups/allGroups.html → group/src/main/resources/templates/groups/groupKnowledge.html
- `Group Row Dropdown Menu` --references--> `Group Details Page`  [INFERRED]
  group/src/main/resources/templates/groups/allGroups.html → group/src/main/resources/templates/groups/groupDetails.html

## Communities

### Community 0 - "Knowledge Service Layer"
Cohesion: 0.07
Nodes (4): GroupKnowledgeService, GroupPermissionRepository, GroupPermissionService, GroupWebController

### Community 1 - "All Groups UI"
Cohesion: 0.1
Nodes (25): Flash Messages (Success/Error), All Groups Navbar, All Groups Page, API: GET /api/groups/create, API: GET /groups/{id}/knowledge, API: GET /api/groups, API: GET /stats, facts.css (+17 more)

### Community 2 - "Group List & Navigation"
Cohesion: 0.13
Nodes (18): Group Row Dropdown Menu, Groups Table (All Groups), API: GET /group/social/{id}, API: GET /api/groups/{id}, API: GET /api/groups/{id}/knowledge, groupDetails.css, Contacts Feature (Coming Soon Placeholder), Delete Group Action (+10 more)

### Community 3 - "Group API Controller"
Cohesion: 0.12
Nodes (2): GroupApiController, SocialGroupService

### Community 4 - "File Request Models"
Cohesion: 0.19
Nodes (2): FileDeleteRequest, GroupFileController

### Community 5 - "File Upload & Delete"
Cohesion: 0.28
Nodes (2): GroupFileService, SocialGroup

### Community 6 - "Permission Controller"
Cohesion: 0.25
Nodes (1): GroupPermissionController

### Community 7 - "Social Controller"
Cohesion: 0.29
Nodes (1): GroupSocialController

### Community 8 - "Social Service"
Cohesion: 0.29
Nodes (1): GroupSocialService

### Community 9 - "Knowledge Repository"
Cohesion: 0.4
Nodes (1): GroupKnowledgeRepository

### Community 10 - "CORS Web Config"
Cohesion: 0.67
Nodes (1): WebConfig

### Community 11 - "Application Bootstrap"
Cohesion: 0.67
Nodes (1): GroupApplication

### Community 12 - "WebClient Config"
Cohesion: 0.67
Nodes (1): WebClientConfig

### Community 13 - "Test Suite"
Cohesion: 0.67
Nodes (1): GroupApplicationTests

### Community 14 - "Knowledge Entity"
Cohesion: 1.0
Nodes (1): GroupKnowledge

### Community 15 - "Permission Entity"
Cohesion: 1.0
Nodes (1): GroupPermission

### Community 16 - "Photo Entity"
Cohesion: 1.0
Nodes (1): GroupPhoto

### Community 17 - "Resource Entity"
Cohesion: 1.0
Nodes (1): GroupResource

### Community 18 - "Social Entity"
Cohesion: 1.0
Nodes (1): GroupSocial

### Community 19 - "Video Entity"
Cohesion: 1.0
Nodes (1): GroupVideo

### Community 20 - "Photo Repository"
Cohesion: 1.0
Nodes (1): GroupPhotoRepository

### Community 21 - "Resource Repository"
Cohesion: 1.0
Nodes (1): GroupResourceRepository

### Community 22 - "Social Repository"
Cohesion: 1.0
Nodes (1): GroupSocialRepository

### Community 23 - "Video Repository"
Cohesion: 1.0
Nodes (1): GroupVideoRepository

### Community 24 - "Social Group Repository"
Cohesion: 1.0
Nodes (1): SocialGroupRepository

### Community 25 - "Create Group Endpoint"
Cohesion: 1.0
Nodes (1): API: GET /api/groups/createGroup

## Knowledge Gaps
- **29 isolated node(s):** `GroupKnowledge`, `GroupPermission`, `GroupPhoto`, `GroupResource`, `GroupSocial` (+24 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Group API Controller`** (17 nodes): `GroupApiController`, `.addKnowledgeToGroup()`, `.createGroup()`, `.deleteGroup()`, `.deleteKnowledge()`, `.getAllGroupKnowledge()`, `.getGroupDetails()`, `.getGroupKnowledgePage()`, `GroupApiController.java`, `SocialGroupService.java`, `SocialGroupService`, `.createGroup()`, `.deleteGroup()`, `.getAllGroups()`, `.getGroupById()`, `.setPrimaryPhoto()`, `.updateGroup()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `File Request Models`** (14 nodes): `FileDeleteRequest`, `.getGroupId()`, `.getPhotoIds()`, `.getResourceIds()`, `.getVideoIds()`, `.setGroupId()`, `.setPhotoIds()`, `.setResourceIds()`, `.setVideoIds()`, `GroupFileController`, `.deleteFiles()`, `.getPrimaryPhoto()`, `.setPrimaryPhoto()`, `GroupFileController.java`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `File Upload & Delete`** (9 nodes): `.uploadFiles()`, `GroupFileService`, `.deleteFiles()`, `.deleteFilesFromResourceRepository()`, `.saveFiles()`, `.uploadFileToResourceRepository()`, `SocialGroup.java`, `GroupFileService.java`, `SocialGroup`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Permission Controller`** (8 nodes): `GroupPermissionController`, `.addPermissionToGroup()`, `.deletePermission()`, `.getAllGroupPermission()`, `.getGroupPermissionPage()`, `.updatePermission()`, `.getPermissionById()`, `GroupPermissionController.java`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Social Controller`** (7 nodes): `GroupSocialController`, `.createGroupSocial()`, `.deleteGroupSocial()`, `.getAllGroupSocialsForGroup()`, `.getGroupSocialById()`, `.updateGroupSocial()`, `GroupSocialController.java`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Social Service`** (7 nodes): `GroupSocialService`, `.createGroupSocial()`, `.deleteGroupSocial()`, `.getAllGroupSocialsForGroup()`, `.getGroupSocialById()`, `.updateGroupSocial()`, `GroupSocialService.java`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Knowledge Repository`** (5 nodes): `GroupKnowledgeRepository`, `.countByGroupId()`, `.findByGroupId()`, `.findByGroupIdOrderByDateDesc()`, `GroupKnowledgeRepository.java`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `CORS Web Config`** (4 nodes): `WebConfig.java`, `WebConfig`, `.corsConfigurationSource()`, `.filterChain()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Application Bootstrap`** (3 nodes): `GroupApplication`, `.main()`, `GroupApplication.java`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `WebClient Config`** (3 nodes): `WebClientConfig.java`, `WebClientConfig`, `.webClient()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Test Suite`** (3 nodes): `GroupApplicationTests`, `.contextLoads()`, `GroupApplicationTests.java`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Knowledge Entity`** (2 nodes): `GroupKnowledge`, `GroupKnowledge.java`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Permission Entity`** (2 nodes): `GroupPermission`, `GroupPermission.java`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Photo Entity`** (2 nodes): `GroupPhoto`, `GroupPhoto.java`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Resource Entity`** (2 nodes): `GroupResource`, `GroupResource.java`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Social Entity`** (2 nodes): `GroupSocial`, `GroupSocial.java`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Video Entity`** (2 nodes): `GroupVideo`, `GroupVideo.java`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Photo Repository`** (2 nodes): `GroupPhotoRepository`, `GroupPhotoRepository.java`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Resource Repository`** (2 nodes): `GroupResourceRepository`, `GroupResourceRepository.java`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Social Repository`** (2 nodes): `GroupSocialRepository`, `GroupSocialRepository.java`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Video Repository`** (2 nodes): `GroupVideoRepository`, `GroupVideoRepository.java`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Social Group Repository`** (2 nodes): `SocialGroupRepository.java`, `SocialGroupRepository`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Create Group Endpoint`** (1 nodes): `API: GET /api/groups/createGroup`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `GroupFileController` connect `File Request Models` to `File Upload & Delete`?**
  _High betweenness centrality (0.086) - this node is a cross-community bridge._
- **Why does `GroupPermissionService` connect `Knowledge Service Layer` to `Permission Controller`?**
  _High betweenness centrality (0.035) - this node is a cross-community bridge._
- **Are the 3 inferred relationships involving `Group Knowledge Tracker Page` (e.g. with `Group Row Dropdown Menu` and `Group Notes Section`) actually correct?**
  _`Group Knowledge Tracker Page` has 3 INFERRED edges - model-reasoned connections that need verification._
- **What connects `GroupKnowledge`, `GroupPermission`, `GroupPhoto` to the rest of the system?**
  _29 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Knowledge Service Layer` be split into smaller, more focused modules?**
  _Cohesion score 0.07 - nodes in this community are weakly interconnected._
- **Should `All Groups UI` be split into smaller, more focused modules?**
  _Cohesion score 0.1 - nodes in this community are weakly interconnected._
- **Should `Group List & Navigation` be split into smaller, more focused modules?**
  _Cohesion score 0.13 - nodes in this community are weakly interconnected._