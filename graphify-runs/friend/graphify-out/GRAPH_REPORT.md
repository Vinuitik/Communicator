# Graph Report - .  (2026-05-04)

## Corpus Check
- Corpus is ~13,164 words - fits in a single context window. You may not need a graph.

## Summary
- 402 nodes · 527 edges · 37 communities detected
- Extraction: 74% EXTRACTED · 26% INFERRED · 0% AMBIGUOUS · INFERRED: 137 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Templates + Core Concepts|Templates + Core Concepts]]
- [[_COMMUNITY_Permissions + Knowledge Service|Permissions + Knowledge Service]]
- [[_COMMUNITY_Friend Service + Photo Lookup|Friend Service + Photo Lookup]]
- [[_COMMUNITY_Friend Controller + Meetings|Friend Controller + Meetings]]
- [[_COMMUNITY_File Metadata + Photo Queries|File Metadata + Photo Queries]]
- [[_COMMUNITY_Analytics + Interaction Queries|Analytics + Interaction Queries]]
- [[_COMMUNITY_Meetings + Events|Meetings + Events]]
- [[_COMMUNITY_Social Links (API + Service + Repo)|Social Links (API + Service + Repo)]]
- [[_COMMUNITY_Friend Model|Friend Model]]
- [[_COMMUNITY_File Upload + Deletion|File Upload + Deletion]]
- [[_COMMUNITY_Personal Resources Repository|Personal Resources Repository]]
- [[_COMMUNITY_Events Repo + Meeting Generation|Events Repo + Meeting Generation]]
- [[_COMMUNITY_Photos Repository|Photos Repository]]
- [[_COMMUNITY_Friend Knowledge API|Friend Knowledge API]]
- [[_COMMUNITY_Group Membership API|Group Membership API]]
- [[_COMMUNITY_Friend Form Fields|Friend Form Fields]]
- [[_COMMUNITY_Knowledge Repository|Knowledge Repository]]
- [[_COMMUNITY_Facts Form Fields|Facts Form Fields]]
- [[_COMMUNITY_Web Config (Static Resources)|Web Config (Static Resources)]]
- [[_COMMUNITY_gRPC Server Lifecycle|gRPC Server Lifecycle]]
- [[_COMMUNITY_Meeting Generation gRPC Service|Meeting Generation gRPC Service]]
- [[_COMMUNITY_App Entry Point|App Entry Point]]
- [[_COMMUNITY_WebClient Config|WebClient Config]]
- [[_COMMUNITY_DTO FriendAndHours|DTO: FriendAndHours]]
- [[_COMMUNITY_MCP DTO Knowledge|MCP DTO: Knowledge]]
- [[_COMMUNITY_DTO Pagination|DTO: Pagination]]
- [[_COMMUNITY_DTO Social|DTO: Social]]
- [[_COMMUNITY_Analytics Model|Analytics Model]]
- [[_COMMUNITY_Friend Event Model|Friend Event Model]]
- [[_COMMUNITY_Friend Knowledge Model|Friend Knowledge Model]]
- [[_COMMUNITY_Friend Permission Model|Friend Permission Model]]
- [[_COMMUNITY_Group Member Model|Group Member Model]]
- [[_COMMUNITY_Meeting Model|Meeting Model]]
- [[_COMMUNITY_Personal Resource Model|Personal Resource Model]]
- [[_COMMUNITY_Photos Model|Photos Model]]
- [[_COMMUNITY_Social Model|Social Model]]
- [[_COMMUNITY_Videos Model|Videos Model]]

## God Nodes (most connected - your core abstractions)
1. `FriendController` - 24 edges
2. `Friend Profile Page` - 24 edges
3. `FriendService` - 22 edges
4. `Knowledge Tracker Page (Facts)` - 15 edges
5. `PersonalResourceRepository` - 13 edges
6. `PhotosRepository` - 11 edges
7. `VideosRepository` - 10 edges
8. `FriendKnowledgeService` - 10 edges
9. `Talked Form Page (Add/Edit Friend + Knowledge)` - 10 edges
10. `FriendKnowledgeController` - 9 edges

## Surprising Connections (you probably didn't know these)
- `Knowledge Tracker Page (Facts)` --semantically_similar_to--> `Talked Form Page (Add/Edit Friend + Knowledge)`  [INFERRED] [semantically similar]
  friend/src/main/resources/templates/facts.html → friend/src/main/resources/templates/talkedForm.html
- `Facts Page Script (/facts/facts.js)` --conceptually_related_to--> `Knowledge Table Module (/profile/modules/knowledgeTable.js)`  [AMBIGUOUS]
  friend/src/main/resources/templates/facts.html → friend/src/main/resources/templates/profile.html
- `Talked Form Page (Add/Edit Friend + Knowledge)` --conceptually_related_to--> `Friend (entity)`  [INFERRED]
  friend/src/main/resources/templates/talkedForm.html → friend/src/main/resources/templates/profile.html
- `Friend Profile Page` --references--> `Home Route (/calendarView/calendar.html)`  [EXTRACTED]
  friend/src/main/resources/templates/profile.html → friend/src/main/resources/templates/facts.html
- `Friend Profile Page` --references--> `Add Friend Route (/addFriendForm/addForm.html)`  [EXTRACTED]
  friend/src/main/resources/templates/profile.html → friend/src/main/resources/templates/facts.html

## Communities

### Community 0 - "Templates + Core Concepts"
Cohesion: 0.05
Nodes (51): Navigation Stylesheet (/navigation/navigation.css), Friend (entity), Knowledge (facts about a friend), Add Friend Route (/addFriendForm/addForm.html), Home Route (/calendarView/calendar.html), Index Route (/index), Root Route (/), Stats Route (/stats) (+43 more)

### Community 1 - "Permissions + Knowledge Service"
Cohesion: 0.08
Nodes (4): FriendKnowledgeService, FriendPermissionController, FriendPermissionRepository, FriendPermissionService

### Community 2 - "Friend Service + Photo Lookup"
Cohesion: 0.08
Nodes (3): FriendRepository, FriendService, WebController

### Community 3 - "Friend Controller + Meetings"
Cohesion: 0.09
Nodes (2): FriendController, MeetingService

### Community 4 - "File Metadata + Photo Queries"
Cohesion: 0.11
Nodes (3): FileMetaDataReadService, PaginationLogicService, VideosRepository

### Community 5 - "Analytics + Interaction Queries"
Cohesion: 0.11
Nodes (6): AnalyticsRepository, AnalyticsService, Coefficients, EmaProperties, EmaUpdateService, FriendAnalyticsController

### Community 6 - "Meetings + Events"
Cohesion: 0.12
Nodes (2): FriendEventService, MeetingRepository

### Community 7 - "Social Links (API + Service + Repo)"
Cohesion: 0.14
Nodes (3): SocialController, SocialRepository, SocialService

### Community 8 - "Friend Model"
Cohesion: 0.14
Nodes (3): Friend, GroupMemberRepository, GroupMemberService

### Community 9 - "File Upload + Deletion"
Cohesion: 0.17
Nodes (2): FileController, FileWriteService

### Community 10 - "Personal Resources Repository"
Cohesion: 0.14
Nodes (1): PersonalResourceRepository

### Community 11 - "Events Repo + Meeting Generation"
Cohesion: 0.22
Nodes (2): FriendEventRepository, MeetingGenerationService

### Community 12 - "Photos Repository"
Cohesion: 0.17
Nodes (1): PhotosRepository

### Community 13 - "Friend Knowledge API"
Cohesion: 0.31
Nodes (1): FriendKnowledgeController

### Community 14 - "Group Membership API"
Cohesion: 0.22
Nodes (1): GroupMemberController

### Community 15 - "Friend Form Fields"
Cohesion: 0.29
Nodes (7): Submit Friend Form (submit), Date of Birth (date input), Experience (select: Great/Okay/Bad), Friend ID (hidden input), Hours Spoken (number input), Name (text input), Friend Form (Add/Edit Friend)

### Community 16 - "Knowledge Repository"
Cohesion: 0.33
Nodes (1): FriendKnowledgeRepository

### Community 17 - "Facts Form Fields"
Cohesion: 0.33
Nodes (6): Fact (knowledge text), Importance (priority/weight), Add Knowledge (submit), Fact (textarea), Importance (number input), Add New Knowledge Form

### Community 18 - "Web Config (Static Resources)"
Cohesion: 0.67
Nodes (2): WebConfig, WebMvcConfigurer

### Community 19 - "gRPC Server Lifecycle"
Cohesion: 0.5
Nodes (1): GrpcServerLifecycle

### Community 20 - "Meeting Generation gRPC Service"
Cohesion: 0.5
Nodes (1): MeetingGenerationGrpcService

### Community 21 - "App Entry Point"
Cohesion: 0.67
Nodes (1): Main

### Community 22 - "WebClient Config"
Cohesion: 0.67
Nodes (1): WebClientConfig

### Community 23 - "DTO: FriendAndHours"
Cohesion: 1.0
Nodes (1): FriendAndHoursDTO

### Community 24 - "MCP DTO: Knowledge"
Cohesion: 1.0
Nodes (1): MCP_Knowledge_DTO

### Community 25 - "DTO: Pagination"
Cohesion: 1.0
Nodes (1): PaginationDTO

### Community 26 - "DTO: Social"
Cohesion: 1.0
Nodes (1): SocialDTO

### Community 27 - "Analytics Model"
Cohesion: 1.0
Nodes (1): Analytics

### Community 28 - "Friend Event Model"
Cohesion: 1.0
Nodes (1): FriendEvent

### Community 29 - "Friend Knowledge Model"
Cohesion: 1.0
Nodes (1): FriendKnowledge

### Community 30 - "Friend Permission Model"
Cohesion: 1.0
Nodes (1): FriendPermission

### Community 31 - "Group Member Model"
Cohesion: 1.0
Nodes (1): GroupMember

### Community 32 - "Meeting Model"
Cohesion: 1.0
Nodes (1): Meeting

### Community 33 - "Personal Resource Model"
Cohesion: 1.0
Nodes (1): PersonalResource

### Community 34 - "Photos Model"
Cohesion: 1.0
Nodes (1): Photos

### Community 35 - "Social Model"
Cohesion: 1.0
Nodes (1): Social

### Community 36 - "Videos Model"
Cohesion: 1.0
Nodes (1): Videos

## Ambiguous Edges - Review These
- `Facts Page Script (/facts/facts.js)` → `Knowledge Table Module (/profile/modules/knowledgeTable.js)`  [AMBIGUOUS]
  friend/src/main/resources/templates/profile.html · relation: conceptually_related_to

## Knowledge Gaps
- **55 isolated node(s):** `Coefficients`, `FriendAndHoursDTO`, `MCP_Knowledge_DTO`, `PaginationDTO`, `SocialDTO` (+50 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Friend Controller + Meetings`** (31 nodes): `FriendController.java`, `MeetingService.java`, `FriendController`, `.createFriendEvent()`, `.createFriendMeeting()`, `.deleteFriend()`, `.deleteMeeting()`, `.getAllFriends()`, `.getFriendEvents()`, `.getFriendMeetings()`, `.getFriendsCount()`, `.getFriendsPaginated()`, `.getFriendsPaginatedCustomSize()`, `.getPrimaryPhoto()`, `.setPrimaryPhoto()`, `.updateFriendAverages()`, `.updateMeeting()`, `.addKnowledge()`, `.deleteKnowledge()`, `.deleteKnowledgeById()`, `.deletePermission()`, `.deletePermissionById()`, `.deleteFriendById()`, `.getFriendById()`, `MeetingService`, `.deleteById()`, `.getByFriendId()`, `.getById()`, `.getByIdAndFriendId()`, `.updateMeeting()`, `.deleteSocial()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Meetings + Events`** (20 nodes): `MeetingRepository.java`, `FriendEventService.java`, `.deleteFriendEvent()`, `.updateFriendEvent()`, `FriendEventService`, `.deleteById()`, `.deleteForFriend()`, `.getByFriendId()`, `.getById()`, `.getByIdAndFriendId()`, `.save()`, `.updateForFriend()`, `MeetingRepository`, `.existsByEventIdAndMeetingDateGreaterThanEqual()`, `.findByFriendId()`, `.findByFriendIdAndMeetingDateAfter()`, `.findByIdAndFriendId()`, `.findByMeetingDateAfterOrderByMeetingDateAsc()`, `.getFutureByFriendId()`, `.getUpcoming()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `File Upload + Deletion`** (16 nodes): `FileController`, `.deleteFiles()`, `.getFileUploadPage()`, `.uploadFiles()`, `.getResource()`, `FileWriteService`, `.deleteFiles()`, `.deleteFilesFromRepository()`, `.flushMetadata()`, `.getFileCategory()`, `.getFileExtension()`, `.saveFileMetadata()`, `.saveFiles()`, `.saveFilesToRepository()`, `FileController.java`, `FileWriteService.java`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Personal Resources Repository`** (14 nodes): `PersonalResourceRepository.java`, `PersonalResourceRepository`, `.countByFriendId()`, `.existsByFriendIdAndResourceName()`, `.findAllByFriend()`, `.findByFriendId()`, `.findByFriendIdAndMimeType()`, `.findByFriendIdAndResourceName()`, `.findByFriendIdOrderByTimeBuiltDesc()`, `.findByFriendIdOrderByTimeBuiltDescWithLimitOffset()`, `.findByMimeType()`, `.findByResourceNameAndFriend()`, `.findByResourceNameContainingIgnoreCase()`, `.findResourceMetadataByFriendId()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Events Repo + Meeting Generation`** (13 nodes): `FriendEventRepository.java`, `MeetingGenerationService.java`, `FriendEventRepository`, `.findByActiveTrue()`, `.findByFriendId()`, `.findByFriendIdAndActiveTrue()`, `.findByIdAndFriendId()`, `MeetingGenerationService`, `.calculateNextOccurrence()`, `.generateIfMissing()`, `.generateMissingNextMeetings()`, `.generateMissingNextMeetingsForAllFriends()`, `.generateMissingNextMeetingsForFriend()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Photos Repository`** (12 nodes): `PhotosRepository.java`, `PhotosRepository`, `.countByFriendId()`, `.existsByFriendIdAndPhotoName()`, `.findAllByFriend()`, `.findByFriendId()`, `.findByFriendIdAndPhotoName()`, `.findByFriendIdOrderByTimeBuiltDesc()`, `.findByFriendIdOrderByTimeBuiltDescWithLimitOffset()`, `.findByPhotoNameAndFriend()`, `.findByPhotoNameContainingIgnoreCase()`, `.findPhotoByFriendId()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Friend Knowledge API`** (9 nodes): `FriendKnowledgeController.java`, `FriendKnowledgeController`, `.getKnowledgeById()`, `.getKnowledgeIdsByFriendId()`, `.getKnowledgePaginated()`, `.getKnowledgePaginatedCustomSize()`, `.getKnowledgeTextById()`, `.updateKnowledge()`, `.getKnowledgeByFriendIdPaginated()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Group Membership API`** (9 nodes): `GroupMemberController.java`, `GroupMemberController`, `.addFriendsToGroup()`, `.addFriendsToGroups()`, `.addFriendToGroups()`, `.getFriendsByGroupId()`, `.getGroupMembersByFriendId()`, `.getGroupMembersByGroupId()`, `.getGroupsByFriendId()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Knowledge Repository`** (6 nodes): `FriendKnowledgeRepository.java`, `FriendKnowledgeRepository`, `.findAllSortedByFriendIdAndPriority()`, `.findAllSortedByPriority()`, `.findByFriendId()`, `.findById()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Web Config (Static Resources)`** (4 nodes): `WebConfig.java`, `WebConfig`, `.addResourceHandlers()`, `WebMvcConfigurer`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `gRPC Server Lifecycle`** (4 nodes): `GrpcServerLifecycle.java`, `GrpcServerLifecycle`, `.start()`, `.stop()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Meeting Generation gRPC Service`** (4 nodes): `MeetingGenerationGrpcService.java`, `MeetingGenerationGrpcService`, `.generateMissingNextMeetingsForAllFriends()`, `.generateMissingNextMeetingsForFriend()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `App Entry Point`** (3 nodes): `Main.java`, `Main`, `.main()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `WebClient Config`** (3 nodes): `WebClientConfig.java`, `WebClientConfig`, `.webClient()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `DTO: FriendAndHours`** (2 nodes): `FriendAndHoursDTO.java`, `FriendAndHoursDTO`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `MCP DTO: Knowledge`** (2 nodes): `MCP_Knowledge_DTO.java`, `MCP_Knowledge_DTO`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `DTO: Pagination`** (2 nodes): `PaginationDTO.java`, `PaginationDTO`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `DTO: Social`** (2 nodes): `SocialDTO.java`, `SocialDTO`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Analytics Model`** (2 nodes): `Analytics`, `Analytics.java`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Friend Event Model`** (2 nodes): `FriendEvent.java`, `FriendEvent`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Friend Knowledge Model`** (2 nodes): `FriendKnowledge.java`, `FriendKnowledge`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Friend Permission Model`** (2 nodes): `FriendPermission.java`, `FriendPermission`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Group Member Model`** (2 nodes): `GroupMember.java`, `GroupMember`
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

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `Facts Page Script (/facts/facts.js)` and `Knowledge Table Module (/profile/modules/knowledgeTable.js)`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **Why does `FriendService` connect `Friend Service + Photo Lookup` to `Permissions + Knowledge Service`, `Friend Controller + Meetings`?**
  _High betweenness centrality (0.060) - this node is a cross-community bridge._
- **Why does `FriendController` connect `Friend Controller + Meetings` to `Permissions + Knowledge Service`, `Friend Service + Photo Lookup`, `Analytics + Interaction Queries`, `Meetings + Events`?**
  _High betweenness centrality (0.055) - this node is a cross-community bridge._
- **Why does `SocialService` connect `Social Links (API + Service + Repo)` to `Friend Controller + Meetings`?**
  _High betweenness centrality (0.044) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `Knowledge Tracker Page (Facts)` (e.g. with `Knowledge (facts about a friend)` and `Talked Form Page (Add/Edit Friend + Knowledge)`) actually correct?**
  _`Knowledge Tracker Page (Facts)` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Coefficients`, `FriendAndHoursDTO`, `MCP_Knowledge_DTO` to the rest of the system?**
  _55 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Templates + Core Concepts` be split into smaller, more focused modules?**
  _Cohesion score 0.05 - nodes in this community are weakly interconnected._