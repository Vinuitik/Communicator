# Graph Report - .  (2026-05-06)

## Corpus Check
- Corpus is ~22,498 words - fits in a single context window. You may not need a graph.

## Summary
- 682 nodes · 1029 edges · 66 communities detected
- Extraction: 60% EXTRACTED · 34% INFERRED · 0% AMBIGUOUS · INFERRED: 353 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Group API & Controllers|Group API & Controllers]]
- [[_COMMUNITY_Friend API & Controllers|Friend API & Controllers]]
- [[_COMMUNITY_Integration Test Suite|Integration Test Suite]]
- [[_COMMUNITY_Friend Query & Pagination|Friend Query & Pagination]]
- [[_COMMUNITY_Chrono Decay Engine|Chrono Decay Engine]]
- [[_COMMUNITY_Knowledge Facts UI|Knowledge Facts UI]]
- [[_COMMUNITY_Friend CRUD & Knowledge Service|Friend CRUD & Knowledge Service]]
- [[_COMMUNITY_File Upload & Management|File Upload & Management]]
- [[_COMMUNITY_EMA Configuration|EMA Configuration]]
- [[_COMMUNITY_File Write & Resource Service|File Write & Resource Service]]
- [[_COMMUNITY_Decay Unit Tests|Decay Unit Tests]]
- [[_COMMUNITY_File Metadata & Photo Queries|File Metadata & Photo Queries]]
- [[_COMMUNITY_Groups UI & Navigation|Groups UI & Navigation]]
- [[_COMMUNITY_System Test Suite|System Test Suite]]
- [[_COMMUNITY_Moving Average Calculation|Moving Average Calculation]]
- [[_COMMUNITY_Social Links (Friend)|Social Links (Friend)]]
- [[_COMMUNITY_Core Test Infrastructure|Core Test Infrastructure]]
- [[_COMMUNITY_Analytics Service|Analytics Service]]
- [[_COMMUNITY_Personal Resource Repository|Personal Resource Repository]]
- [[_COMMUNITY_Photos Repository|Photos Repository]]
- [[_COMMUNITY_Friend Knowledge API|Friend Knowledge API]]
- [[_COMMUNITY_Group Membership API|Group Membership API]]
- [[_COMMUNITY_Group Social Links|Group Social Links]]
- [[_COMMUNITY_Web & Security Config|Web & Security Config]]
- [[_COMMUNITY_Knowledge Repository|Knowledge Repository]]
- [[_COMMUNITY_Group Knowledge Repository|Group Knowledge Repository]]
- [[_COMMUNITY_Chrono Controller|Chrono Controller]]
- [[_COMMUNITY_Application Entry Point|Application Entry Point]]
- [[_COMMUNITY_Connection Entity|Connection Entity]]
- [[_COMMUNITY_Connection Identity|Connection Identity]]
- [[_COMMUNITY_HTTP Client Config|HTTP Client Config]]
- [[_COMMUNITY_Analytics Entry DTO|Analytics Entry DTO]]
- [[_COMMUNITY_Friend Summary DTO|Friend Summary DTO]]
- [[_COMMUNITY_Friend Update DTO|Friend Update DTO]]
- [[_COMMUNITY_Connections Controller|Connections Controller]]
- [[_COMMUNITY_Connection Permission|Connection Permission]]
- [[_COMMUNITY_Connection Knowledge|Connection Knowledge]]
- [[_COMMUNITY_Connection Knowledge Service|Connection Knowledge Service]]
- [[_COMMUNITY_Connection Permission Service|Connection Permission Service]]
- [[_COMMUNITY_Connection Service|Connection Service]]
- [[_COMMUNITY_Connection Permission Repo|Connection Permission Repo]]
- [[_COMMUNITY_Connection Repository|Connection Repository]]
- [[_COMMUNITY_Connection Knowledge Repo|Connection Knowledge Repo]]
- [[_COMMUNITY_Friend Hours DTO|Friend Hours DTO]]
- [[_COMMUNITY_MCP Knowledge DTO|MCP Knowledge DTO]]
- [[_COMMUNITY_Pagination DTO|Pagination DTO]]
- [[_COMMUNITY_Social DTO|Social DTO]]
- [[_COMMUNITY_Friend Permission Model|Friend Permission Model]]
- [[_COMMUNITY_Group Member Model|Group Member Model]]
- [[_COMMUNITY_Meeting Model|Meeting Model]]
- [[_COMMUNITY_Personal Resource Model|Personal Resource Model]]
- [[_COMMUNITY_Photos Model|Photos Model]]
- [[_COMMUNITY_Social Model|Social Model]]
- [[_COMMUNITY_Videos Model|Videos Model]]
- [[_COMMUNITY_Group Knowledge Model|Group Knowledge Model]]
- [[_COMMUNITY_Group Permission Model|Group Permission Model]]
- [[_COMMUNITY_Group Photo Model|Group Photo Model]]
- [[_COMMUNITY_Group Resource Model|Group Resource Model]]
- [[_COMMUNITY_Group Social Model|Group Social Model]]
- [[_COMMUNITY_Group Video Model|Group Video Model]]
- [[_COMMUNITY_Group Photo Repository|Group Photo Repository]]
- [[_COMMUNITY_Group Resource Repository|Group Resource Repository]]
- [[_COMMUNITY_Group Social Repository|Group Social Repository]]
- [[_COMMUNITY_Group Video Repository|Group Video Repository]]
- [[_COMMUNITY_Social Group Repository|Social Group Repository]]
- [[_COMMUNITY_Profile Media UI|Profile Media UI]]

## God Nodes (most connected - your core abstractions)
1. `FriendController` - 24 edges
2. `FriendService` - 22 edges
3. `ChronoPropertiesAlphaTest` - 14 edges
4. `MovingAverageCalculationServiceTest` - 14 edges
5. `PersonalResourceRepository` - 13 edges
6. `AnalyticsRepositoryIT` - 12 edges
7. `ChronoDecayMathTest` - 12 edges
8. `PhotosRepository` - 11 edges
9. `VideosRepository` - 10 edges
10. `FriendKnowledgeService` - 10 edges

## Surprising Connections (you probably didn't know these)
- `Knowledge About Friend Section` --links_to--> `Facts / Knowledge Tracker Page`  [0.8]
  src/main/resources/templates/profile.html → src/main/resources/templates/facts.html
- `Inline Knowledge Form (knowledgeForm)` --mirrors_component--> `Add New Knowledge Form`  [0.9]
  src/main/resources/templates/talkedForm.html → src/main/resources/templates/facts.html
- `Talked / Edit Friend Form Page` --loads_module--> `facts.js Module`  [1.0]
  src/main/resources/templates/talkedForm.html → src/main/resources/templates/facts.html
- `Link -> /groups/{id}/knowledge` --links_to--> `Group Knowledge Tracker Page`  [1.0]
  src/main/resources/templates/groups/groupDetails.html → src/main/resources/templates/groups/groupKnowledge.html
- `Add Group Knowledge Form (knowledgeForm)` --mirrors_component--> `Add New Knowledge Form`  [0.9]
  src/main/resources/templates/groups/groupKnowledge.html → src/main/resources/templates/facts.html

## Communities

### Community 0 - "Group API & Controllers"
Cohesion: 0.04
Nodes (7): GroupApiController, GroupKnowledgeService, GroupPermissionController, GroupPermissionRepository, GroupPermissionService, GroupWebController, SocialGroupService

### Community 1 - "Friend API & Controllers"
Cohesion: 0.06
Nodes (4): FriendController, FriendEventService, MeetingRepository, MeetingService

### Community 2 - "Integration Test Suite"
Cohesion: 0.11
Nodes (6): AbstractIntegrationTest, AnalyticsRepository, AnalyticsRepositoryIT, FriendKnowledgeRepositoryIT, FriendKnowledgeService, MeetingGenerationServiceIT

### Community 3 - "Friend Query & Pagination"
Cohesion: 0.09
Nodes (2): FriendRepository, FriendService

### Community 4 - "Chrono Decay Engine"
Cohesion: 0.11
Nodes (5): ChronoJobService, ChronoJobServiceIT, FriendRepositoryIT, GroupSocialService, WebController

### Community 5 - "Knowledge Facts UI"
Cohesion: 0.06
Nodes (33): Committed Knowledge Table (committedTable), Fact Text Input (factInput), Friend ID Data Attribute (data-friend-id), Importance Number Input (importanceInput), facts.js Module, Add New Knowledge Form, Pending Knowledge Table (knowledgeTable), Facts / Knowledge Tracker Page (+25 more)

### Community 6 - "Friend CRUD & Knowledge Service"
Cohesion: 0.08
Nodes (3): FriendPermissionController, FriendPermissionRepository, FriendPermissionService

### Community 7 - "File Upload & Management"
Cohesion: 0.09
Nodes (5): FileController, FileDeleteRequest, GroupFileController, GroupFileService, SocialGroup

### Community 8 - "EMA Configuration"
Cohesion: 0.11
Nodes (7): ChronoProperties, Coefficients, FriendService, Grpc, ChronoPropertiesAlphaTest, Coefficients, EmaProperties

### Community 9 - "File Write & Resource Service"
Cohesion: 0.11
Nodes (3): FileWriteService, GroupMemberRepository, GroupMemberService

### Community 10 - "Decay Unit Tests"
Cohesion: 0.15
Nodes (3): ChronoDecayMathTest, FriendEventRepository, MeetingGenerationService

### Community 11 - "File Metadata & Photo Queries"
Cohesion: 0.11
Nodes (3): FileMetaDataReadService, PaginationLogicService, VideosRepository

### Community 12 - "Groups UI & Navigation"
Cohesion: 0.1
Nodes (22): API Endpoint: /api/groups, Create New Group Button -> /api/groups/createGroup, deleteGroup() JS Action, Server Model: knowledgeCounts Map, All Groups Listing Page, Server Model: permissionCounts Map, Groups Table (name, contacts, notes, settings, actions), Contacts Section (Coming Soon) (+14 more)

### Community 13 - "System Test Suite"
Cohesion: 0.1
Nodes (4): AbstractSystemTest, AbstractSystemTest, ChronoDecaySystemTest, FriendApiSystemTest

### Community 14 - "Moving Average Calculation"
Cohesion: 0.21
Nodes (2): MovingAverageCalculationService, MovingAverageCalculationServiceTest

### Community 15 - "Social Links (Friend)"
Cohesion: 0.14
Nodes (3): SocialController, SocialRepository, SocialService

### Community 16 - "Core Test Infrastructure"
Cohesion: 0.12
Nodes (6): AbstractIntegrationTest, Analytics, Friend, FriendEvent, FriendKnowledge, WebConfigSecurityIT

### Community 17 - "Analytics Service"
Cohesion: 0.17
Nodes (3): AnalyticsService, EmaUpdateService, FriendAnalyticsController

### Community 18 - "Personal Resource Repository"
Cohesion: 0.14
Nodes (1): PersonalResourceRepository

### Community 19 - "Photos Repository"
Cohesion: 0.17
Nodes (1): PhotosRepository

### Community 20 - "Friend Knowledge API"
Cohesion: 0.21
Nodes (1): FriendKnowledgeController

### Community 21 - "Group Membership API"
Cohesion: 0.22
Nodes (1): GroupMemberController

### Community 22 - "Group Social Links"
Cohesion: 0.29
Nodes (1): GroupSocialController

### Community 23 - "Web & Security Config"
Cohesion: 0.47
Nodes (2): WebConfig, WebMvcConfigurer

### Community 24 - "Knowledge Repository"
Cohesion: 0.33
Nodes (1): FriendKnowledgeRepository

### Community 25 - "Group Knowledge Repository"
Cohesion: 0.4
Nodes (1): GroupKnowledgeRepository

### Community 26 - "Chrono Controller"
Cohesion: 0.5
Nodes (1): ChronoController

### Community 27 - "Application Entry Point"
Cohesion: 0.67
Nodes (1): Main

### Community 28 - "Connection Entity"
Cohesion: 0.67
Nodes (1): Connection

### Community 29 - "Connection Identity"
Cohesion: 1.0
Nodes (2): ConnectionId, Serializable

### Community 30 - "HTTP Client Config"
Cohesion: 0.67
Nodes (1): WebClientConfig

### Community 31 - "Analytics Entry DTO"
Cohesion: 1.0
Nodes (1): AnalyticsEntry

### Community 32 - "Friend Summary DTO"
Cohesion: 1.0
Nodes (1): FriendSummary

### Community 33 - "Friend Update DTO"
Cohesion: 1.0
Nodes (1): FriendUpdateRequest

### Community 34 - "Connections Controller"
Cohesion: 1.0
Nodes (1): ConnectionsController

### Community 35 - "Connection Permission"
Cohesion: 1.0
Nodes (1): ConnectionPermission

### Community 36 - "Connection Knowledge"
Cohesion: 1.0
Nodes (1): ConnectionsKnowledge

### Community 37 - "Connection Knowledge Service"
Cohesion: 1.0
Nodes (1): ConnectionKnowledgeService

### Community 38 - "Connection Permission Service"
Cohesion: 1.0
Nodes (1): ConnectionPermissionService

### Community 39 - "Connection Service"
Cohesion: 1.0
Nodes (1): ConnectionService

### Community 40 - "Connection Permission Repo"
Cohesion: 1.0
Nodes (1): ConnectionPermissionRepository

### Community 41 - "Connection Repository"
Cohesion: 1.0
Nodes (1): ConnectionRepository

### Community 42 - "Connection Knowledge Repo"
Cohesion: 1.0
Nodes (1): ConnectionsKnowledgeRepository

### Community 43 - "Friend Hours DTO"
Cohesion: 1.0
Nodes (1): FriendAndHoursDTO

### Community 44 - "MCP Knowledge DTO"
Cohesion: 1.0
Nodes (1): MCP_Knowledge_DTO

### Community 45 - "Pagination DTO"
Cohesion: 1.0
Nodes (1): PaginationDTO

### Community 46 - "Social DTO"
Cohesion: 1.0
Nodes (1): SocialDTO

### Community 47 - "Friend Permission Model"
Cohesion: 1.0
Nodes (1): FriendPermission

### Community 48 - "Group Member Model"
Cohesion: 1.0
Nodes (1): GroupMember

### Community 49 - "Meeting Model"
Cohesion: 1.0
Nodes (1): Meeting

### Community 50 - "Personal Resource Model"
Cohesion: 1.0
Nodes (1): PersonalResource

### Community 51 - "Photos Model"
Cohesion: 1.0
Nodes (1): Photos

### Community 52 - "Social Model"
Cohesion: 1.0
Nodes (1): Social

### Community 53 - "Videos Model"
Cohesion: 1.0
Nodes (1): Videos

### Community 54 - "Group Knowledge Model"
Cohesion: 1.0
Nodes (1): GroupKnowledge

### Community 55 - "Group Permission Model"
Cohesion: 1.0
Nodes (1): GroupPermission

### Community 56 - "Group Photo Model"
Cohesion: 1.0
Nodes (1): GroupPhoto

### Community 57 - "Group Resource Model"
Cohesion: 1.0
Nodes (1): GroupResource

### Community 58 - "Group Social Model"
Cohesion: 1.0
Nodes (1): GroupSocial

### Community 59 - "Group Video Model"
Cohesion: 1.0
Nodes (1): GroupVideo

### Community 60 - "Group Photo Repository"
Cohesion: 1.0
Nodes (1): GroupPhotoRepository

### Community 61 - "Group Resource Repository"
Cohesion: 1.0
Nodes (1): GroupResourceRepository

### Community 62 - "Group Social Repository"
Cohesion: 1.0
Nodes (1): GroupSocialRepository

### Community 63 - "Group Video Repository"
Cohesion: 1.0
Nodes (1): GroupVideoRepository

### Community 64 - "Social Group Repository"
Cohesion: 1.0
Nodes (1): SocialGroupRepository

### Community 65 - "Profile Media UI"
Cohesion: 1.0
Nodes (2): Media Preview Modal, Add Media Button (mediaUploadButton)

## Knowledge Gaps
- **71 isolated node(s):** `Coefficients`, `FriendService`, `Grpc`, `AnalyticsEntry`, `FriendSummary` (+66 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Friend Query & Pagination`** (33 nodes): `.getFriendsForChrono()`, `.getFriendsPaginatedForUI()`, `.getShortList()`, `.getWeekFriends()`, `.updateFriendAverages()`, `FriendRepository`, `.findAll()`, `.findAllMCPFriendDTOs()`, `.findAllShortFriendDTOs()`, `.findById()`, `.findByName()`, `.findAll_beyondLastPage_returnsEmptyPage()`, `.findAll_paginated_returnsCorrectPage()`, `FriendService`, `.exists()`, `.findThisWeek()`, `.getAllFriends()`, `.getCompressedList()`, `.getFriendsCount()`, `.getFriendsFullPaginated()`, `.getFriendsPagedForUI()`, `.getFriendsPaginated()`, `.getFriendsPaginatedForChrono()`, `.getMonday()`, `.getSunday()`, `.isBefore()`, `.isBetween()`, `.save()`, `.setPrimaryPhoto()`, `.updateFriend()`, `.updateMovingAverages()`, `FriendRepository.java`, `FriendService.java`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Moving Average Calculation`** (20 nodes): `MovingAverageCalculationService.java`, `MovingAverageCalculationService`, `.applyDecayToCurrentValues()`, `.calculateMovingAverages()`, `.convertExperienceToNumber()`, `MovingAverageCalculationServiceTest`, `.emptyAnalytics_appliesDecayToCurrentValues()`, `.entry()`, `.experienceMapping_excellent_mapsToThree()`, `.experienceMapping_good_mapsToTwo()`, `.experienceMapping_null_mapsToZero()`, `.experienceMapping_poor_mapsToOne()`, `.experienceMapping_unknown_mapsToZero()`, `.multipleSameDayEntries_accumulateFrequencyAndDuration()`, `.nullStartingValues_treatedAsZero()`, `.setUp()`, `.singleExcellentEntry_fromZero_producesCorrectEma()`, `.twoDays_activityThenSilence_emaDecaysOnSecondDay()`, `.zeroStartingValues_stayZeroAfterDecay()`, `MovingAverageCalculationServiceTest.java`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Personal Resource Repository`** (14 nodes): `PersonalResourceRepository.java`, `PersonalResourceRepository`, `.countByFriendId()`, `.existsByFriendIdAndResourceName()`, `.findAllByFriend()`, `.findByFriendId()`, `.findByFriendIdAndMimeType()`, `.findByFriendIdAndResourceName()`, `.findByFriendIdOrderByTimeBuiltDesc()`, `.findByFriendIdOrderByTimeBuiltDescWithLimitOffset()`, `.findByMimeType()`, `.findByResourceNameAndFriend()`, `.findByResourceNameContainingIgnoreCase()`, `.findResourceMetadataByFriendId()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Photos Repository`** (12 nodes): `PhotosRepository.java`, `PhotosRepository`, `.countByFriendId()`, `.existsByFriendIdAndPhotoName()`, `.findAllByFriend()`, `.findByFriendId()`, `.findByFriendIdAndPhotoName()`, `.findByFriendIdOrderByTimeBuiltDesc()`, `.findByFriendIdOrderByTimeBuiltDescWithLimitOffset()`, `.findByPhotoNameAndFriend()`, `.findByPhotoNameContainingIgnoreCase()`, `.findPhotoByFriendId()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Friend Knowledge API`** (12 nodes): `FriendKnowledgeController`, `.addKnowledge()`, `.deleteKnowledge()`, `.getKnowledgeById()`, `.getKnowledgeIdsByFriendId()`, `.getKnowledgePaginated()`, `.getKnowledgePaginatedCustomSize()`, `.getKnowledgeTextById()`, `.updateKnowledge()`, `.deleteKnowledgeById()`, `.getKnowledgeByFriendIdPaginated()`, `FriendKnowledgeController.java`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Group Membership API`** (9 nodes): `GroupMemberController`, `.addFriendsToGroup()`, `.addFriendsToGroups()`, `.addFriendToGroups()`, `.getFriendsByGroupId()`, `.getGroupMembersByFriendId()`, `.getGroupMembersByGroupId()`, `.getGroupsByFriendId()`, `GroupMemberController.java`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Group Social Links`** (7 nodes): `GroupSocialController`, `.createGroupSocial()`, `.deleteGroupSocial()`, `.getAllGroupSocialsForGroup()`, `.getGroupSocialById()`, `.updateGroupSocial()`, `GroupSocialController.java`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Web & Security Config`** (6 nodes): `WebConfig.java`, `WebConfig`, `.addResourceHandlers()`, `.corsConfigurationSource()`, `.filterChain()`, `WebMvcConfigurer`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Knowledge Repository`** (6 nodes): `FriendKnowledgeRepository`, `.findAllSortedByFriendIdAndPriority()`, `.findAllSortedByPriority()`, `.findByFriendId()`, `.findById()`, `FriendKnowledgeRepository.java`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Group Knowledge Repository`** (5 nodes): `GroupKnowledgeRepository`, `.countByGroupId()`, `.findByGroupId()`, `.findByGroupIdOrderByDateDesc()`, `GroupKnowledgeRepository.java`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Chrono Controller`** (4 nodes): `ChronoController`, `.health()`, `.triggerManualDecay()`, `ChronoController.java`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Application Entry Point`** (3 nodes): `Main.java`, `Main`, `.main()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Connection Entity`** (3 nodes): `Connection`, `.Connection()`, `Connection.java`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Connection Identity`** (3 nodes): `ConnectionId`, `ConnectionId.java`, `Serializable`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `HTTP Client Config`** (3 nodes): `WebClientConfig.java`, `WebClientConfig`, `.webClient()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Analytics Entry DTO`** (2 nodes): `AnalyticsEntry`, `AnalyticsEntry.java`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Friend Summary DTO`** (2 nodes): `FriendSummary`, `FriendSummary.java`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Friend Update DTO`** (2 nodes): `FriendUpdateRequest`, `FriendUpdateRequest.java`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Connections Controller`** (2 nodes): `ConnectionsController`, `ConnectionsController.java`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Connection Permission`** (2 nodes): `ConnectionPermission`, `ConnectionPermission.java`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Connection Knowledge`** (2 nodes): `ConnectionsKnowledge`, `ConnectionsKnowledge.java`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Connection Knowledge Service`** (2 nodes): `ConnectionKnowledgeService`, `ConnectionKnowledgeService.java`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Connection Permission Service`** (2 nodes): `ConnectionPermissionService`, `ConnectionPermissionService.java`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Connection Service`** (2 nodes): `ConnectionService`, `ConnectionService.java`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Connection Permission Repo`** (2 nodes): `ConnectionPermissionRepository`, `ConnectionPermissionRepository.java`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Connection Repository`** (2 nodes): `ConnectionRepository`, `ConnectionRepository.java`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Connection Knowledge Repo`** (2 nodes): `ConnectionsKnowledgeRepository`, `ConnectionsKnowledgeRepository.java`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Friend Hours DTO`** (2 nodes): `FriendAndHoursDTO`, `FriendAndHoursDTO.java`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `MCP Knowledge DTO`** (2 nodes): `MCP_Knowledge_DTO.java`, `MCP_Knowledge_DTO`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Pagination DTO`** (2 nodes): `PaginationDTO.java`, `PaginationDTO`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Social DTO`** (2 nodes): `SocialDTO.java`, `SocialDTO`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Friend Permission Model`** (2 nodes): `FriendPermission`, `FriendPermission.java`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Group Member Model`** (2 nodes): `GroupMember`, `GroupMember.java`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Meeting Model`** (2 nodes): `Meeting.java`, `Meeting`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Personal Resource Model`** (2 nodes): `PersonalResource.java`, `PersonalResource`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Photos Model`** (2 nodes): `Photos.java`, `Photos`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Social Model`** (2 nodes): `Social.java`, `Social`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Videos Model`** (2 nodes): `Videos.java`, `Videos`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Group Knowledge Model`** (2 nodes): `GroupKnowledge`, `GroupKnowledge.java`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Group Permission Model`** (2 nodes): `GroupPermission`, `GroupPermission.java`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Group Photo Model`** (2 nodes): `GroupPhoto`, `GroupPhoto.java`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Group Resource Model`** (2 nodes): `GroupResource`, `GroupResource.java`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Group Social Model`** (2 nodes): `GroupSocial`, `GroupSocial.java`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Group Video Model`** (2 nodes): `GroupVideo`, `GroupVideo.java`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Group Photo Repository`** (2 nodes): `GroupPhotoRepository`, `GroupPhotoRepository.java`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Group Resource Repository`** (2 nodes): `GroupResourceRepository`, `GroupResourceRepository.java`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Group Social Repository`** (2 nodes): `GroupSocialRepository`, `GroupSocialRepository.java`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Group Video Repository`** (2 nodes): `GroupVideoRepository`, `GroupVideoRepository.java`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Social Group Repository`** (2 nodes): `SocialGroupRepository.java`, `SocialGroupRepository`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Profile Media UI`** (2 nodes): `Media Preview Modal`, `Add Media Button (mediaUploadButton)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `FriendService` connect `Friend Query & Pagination` to `Friend API & Controllers`, `Chrono Decay Engine`, `Friend CRUD & Knowledge Service`?**
  _High betweenness centrality (0.041) - this node is a cross-community bridge._
- **Why does `SocialService` connect `Social Links (Friend)` to `Friend API & Controllers`?**
  _High betweenness centrality (0.030) - this node is a cross-community bridge._
- **What connects `Coefficients`, `FriendService`, `Grpc` to the rest of the system?**
  _71 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Group API & Controllers` be split into smaller, more focused modules?**
  _Cohesion score 0.04 - nodes in this community are weakly interconnected._
- **Should `Friend API & Controllers` be split into smaller, more focused modules?**
  _Cohesion score 0.06 - nodes in this community are weakly interconnected._
- **Should `Integration Test Suite` be split into smaller, more focused modules?**
  _Cohesion score 0.11 - nodes in this community are weakly interconnected._
- **Should `Friend Query & Pagination` be split into smaller, more focused modules?**
  _Cohesion score 0.09 - nodes in this community are weakly interconnected._