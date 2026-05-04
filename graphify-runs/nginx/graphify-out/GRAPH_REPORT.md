# Graph Report - .  (2026-05-03)

## Corpus Check
- Corpus is ~34,597 words - fits in a single context window. You may not need a graph.

## Summary
- 383 nodes · 490 edges · 25 communities detected
- Extraction: 91% EXTRACTED · 9% INFERRED · 0% AMBIGUOUS · INFERRED: 44 edges (avg confidence: 0.79)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_File Upload UI|File Upload UI]]
- [[_COMMUNITY_Form Validation|Form Validation]]
- [[_COMMUNITY_Knowledge Facts UI|Knowledge Facts UI]]
- [[_COMMUNITY_Upload API + Security|Upload API + Security]]
- [[_COMMUNITY_Profile Media Management|Profile Media Management]]
- [[_COMMUNITY_Add Friend Form|Add Friend Form]]
- [[_COMMUNITY_Form UX Helpers|Form UX Helpers]]
- [[_COMMUNITY_AI Test Suite|AI Test Suite]]
- [[_COMMUNITY_Drag & Drop Handling|Drag & Drop Handling]]
- [[_COMMUNITY_Knowledge CRUD|Knowledge CRUD]]
- [[_COMMUNITY_Groups UI|Groups UI]]
- [[_COMMUNITY_Friends Data Fetch|Friends Data Fetch]]
- [[_COMMUNITY_Events + Meetings|Events + Meetings]]
- [[_COMMUNITY_Profile Social Links|Profile Social Links]]
- [[_COMMUNITY_Upload File List Rendering|Upload File List Rendering]]
- [[_COMMUNITY_Analytics Charts|Analytics Charts]]
- [[_COMMUNITY_Calendar UI|Calendar UI]]
- [[_COMMUNITY_Upload Preview Manager|Upload Preview Manager]]
- [[_COMMUNITY_Social Link Fields|Social Link Fields]]
- [[_COMMUNITY_Upload File Validation|Upload File Validation]]
- [[_COMMUNITY_Favicon Assets 192|Favicon Assets 192]]
- [[_COMMUNITY_Favicon Assets 512|Favicon Assets 512]]
- [[_COMMUNITY_Apple Touch Icon|Apple Touch Icon]]
- [[_COMMUNITY_Favicon 16x16|Favicon 16x16]]
- [[_COMMUNITY_Favicon 32x32|Favicon 32x32]]

## God Nodes (most connected - your core abstractions)
1. `KnowledgeManager` - 26 edges
2. `SocialMediaManager` - 15 edges
3. `Profile Page JavaScript Modular Structure` - 14 edges
4. `DragDropHandler` - 12 edges
5. `FileUploader` - 11 edges
6. `File Upload - Add Files Page` - 11 edges
7. `FileCollection` - 10 edges
8. `ProfileSocialManager` - 10 edges
9. `PreviewManager` - 8 edges
10. `showError()` - 7 edges

## Surprising Connections (you probably didn't know these)
- `File Upload System (Drag & Drop + Preview)` --semantically_similar_to--> `Profile Module: modules/mediaUpload.js`  [INFERRED] [semantically similar]
  nginx/static/fileUpload/ReadMe.md → nginx/static/profile/README.md
- `Calendar View - Friend Relationship Management` --conceptually_related_to--> `Meeting Scheduling Flow (Manual Testing)`  [INFERRED]
  nginx/static/calendarView/calendar.html → nginx/static/meeting/index.html
- `Events - Create Recurring Event Form` --conceptually_related_to--> `Meeting Scheduling Flow (Manual Testing)`  [INFERRED]
  nginx/static/events/index.html → nginx/static/meeting/index.html
- `Recurring Event (Base Date + Recurrence Days + Active)` --conceptually_related_to--> `Meeting Scheduling Flow (Manual Testing)`  [INFERRED]
  nginx/static/events/index.html → nginx/static/meeting/index.html
- `Friends Tracker - All Friends Page` --references--> `Calendar View - Friend Relationship Management`  [EXTRACTED]
  nginx/static/index.html → nginx/static/calendarView/calendar.html

## Hyperedges (group relationships)
- **Meeting + Events Manual Scheduling Flow** — meeting_meeting_lab_page, events_create_event_page, concept_friend_id, concept_recurring_event, concept_meeting_scheduling_flow [EXTRACTED 1.00]
- **File Upload Component Suite (JS Classes)** — fileupload_filevalidator_js, fileupload_filecollection_js, fileupload_draganddrop_js, fileupload_filelistrenderer_js, fileupload_previewmanager_js, fileupload_progresstracker_js, fileupload_uploadcontroller_js, fileupload_uistatemanager_js [EXTRACTED 1.00]
- **Profile Media/Gallery Modules** — profile_module_mediaElementFactory, profile_module_galleryManager, profile_module_mediaModal, profile_module_primaryPhoto, profile_module_mediaDeletion, profile_module_mediaUpload, profile_module_pagination, profile_profileApp [EXTRACTED 1.00]

## Communities

### Community 0 - "File Upload UI"
Cohesion: 0.05
Nodes (16): Preview Modal (Media Preview + File Details), FileCollection, File Upload - Add Files Page, fileUpload/JS_Classes/DragAndDropHandler.js, fileUpload/JS_Classes/FileCollection.js, fileUpload/JS_Classes/FileListRenderer.js, FileUploader, fileUpload/JS_Classes/FileUtilities.js (+8 more)

### Community 1 - "Form Validation"
Cohesion: 0.06
Nodes (7): FormValidator, MessageManager, ModalManager, SocialAPIService, SocialListRenderer, SocialMediaManager, URLHelper

### Community 2 - "Knowledge Facts UI"
Cohesion: 0.14
Nodes (1): KnowledgeManager

### Community 3 - "Upload API + Security"
Cohesion: 0.08
Nodes (24): API Endpoint: /api/upload, Drag & Drop Upload Interaction, escapeHtml(text) (XSS Prevention), File Upload System (Drag & Drop + Preview), File Validation (Type/Size/Duplicates/Max Count), Object URL Cleanup (Prevent Memory Leaks), Profile Page JavaScript Modular Structure, Upload Progress Tracking (+16 more)

### Community 4 - "Profile Media Management"
Cohesion: 0.17
Nodes (17): checkIfPrimaryPhoto(), closeMediaModal(), deleteCurrentMedia(), fetchMediaInfo(), formatFileSize(), generateMediaPreview(), initializeMediaModal(), isModalVisible() (+9 more)

### Community 5 - "Add Friend Form"
Cohesion: 0.11
Nodes (20): Add Friend Page, addFriendForm/addForm.js, facts/facts.js, API Endpoint: /api/groups/create, API Endpoint: /api/groups, calendarView/calendar.js, Calendar View - Friend Relationship Management, Date of Birth (+12 more)

### Community 6 - "Form UX Helpers"
Cohesion: 0.2
Nodes (13): addCharacterCounter(), addInvalidFeedback(), addLoadingState(), addValidFeedback(), initializeCharacterCounters(), initializeFormValidation(), removeFeedback(), showError() (+5 more)

### Community 7 - "AI Test Suite"
Cohesion: 0.2
Nodes (11): Knowledge Summarization (Test Suite Feature), WebSocket Chat (Test Suite Feature), clearResults(), displayKnowledgeArray(), displayKnowledgeObject(), displayKnowledgeResults(), displayKnowledgeText(), fetchKnowledgeSummary() (+3 more)

### Community 8 - "Drag & Drop Handling"
Cohesion: 0.19
Nodes (1): DragDropHandler

### Community 9 - "Knowledge CRUD"
Cohesion: 0.32
Nodes (11): addKnowledge(), deleteKnowledge(), getGroupIdFromUrl(), initializeGroupDetails(), initializeKnowledgeActions(), initializeKnowledgeManagement(), loadGroupDetails(), showErrorMessage() (+3 more)

### Community 10 - "Groups UI"
Cohesion: 0.19
Nodes (5): closeAllDropdowns(), showErrorMessage(), showMessage(), showSuccessMessage(), toggleDropdown()

### Community 11 - "Friends Data Fetch"
Cohesion: 0.23
Nodes (7): fetchAllFriends(), fetchWeekFriends(), goToPage(), loadCurrentPage(), updatePaginationControls(), updatePaginationInfo(), viewRequest()

### Community 12 - "Events + Meetings"
Cohesion: 0.22
Nodes (8): Friend ID, Meeting Scheduling Flow (Manual Testing), Recurring Event (Base Date + Recurrence Days + Active), Events - Create Recurring Event Form, formatDateKey(), levelFor(), Meeting Lab Page, renderHeatmap()

### Community 13 - "Profile Social Links"
Cohesion: 0.29
Nodes (1): ProfileSocialManager

### Community 14 - "Upload File List Rendering"
Cohesion: 0.22
Nodes (2): FileListRenderer, FileUtilities

### Community 15 - "Analytics Charts"
Cohesion: 0.29
Nodes (5): Chart.js (CDN), exponentialMovingAverageWithAlphaArray(), Friendship Analytics Page, updateCharts(), API Endpoint: /api/friend/stats

### Community 16 - "Calendar UI"
Cohesion: 0.43
Nodes (6): createDayColumn(), createPreviousColumn(), formatDate(), loadWeeklyCalendar(), renderCalendar(), showErrorMessage()

### Community 17 - "Upload Preview Manager"
Cohesion: 0.32
Nodes (1): PreviewManager

### Community 18 - "Social Link Fields"
Cohesion: 0.4
Nodes (4): Social Platform Options (Instagram, Facebook, Twitter, LinkedIn, GitHub, etc.), Social Media Link (Platform + URL/Contact + Display Name), URL / Contact Field (URL, Phone, Email), Manage Social Media Page

### Community 20 - "Upload File Validation"
Cohesion: 0.5
Nodes (1): FileValidator

### Community 21 - "Favicon Assets 192"
Cohesion: 0.67
Nodes (4): Android Chrome Favicon (192x192), Friendship/relationship theme (human connection), Text: "FRM", Two-person silhouette icon (yellow smaller figure facing teal larger figure)

### Community 22 - "Favicon Assets 512"
Cohesion: 0.67
Nodes (3): FRM App Icon (Android Chrome 512×512), FRM (Text in Icon), Interpersonal Connection / Communication (Two Figures Embracing)

### Community 23 - "Apple Touch Icon"
Cohesion: 0.67
Nodes (3): Apple Touch Icon Image (two-person silhouettes, 'FRM'), Apple Touch Icon (iOS home-screen icon), Text Mark: FRM

### Community 28 - "Favicon 16x16"
Cohesion: 1.0
Nodes (2): Favicon (16x16) Image, Website Favicon

### Community 45 - "Favicon 32x32"
Cohesion: 1.0
Nodes (1): Favicon 32×32

## Ambiguous Edges - Review These
- `Text: "FRM"` → `Friendship/relationship theme (human connection)`  [AMBIGUOUS]
  nginx/static/favicon_io/android-chrome-192x192.png · relation: conceptually_related_to

## Knowledge Gaps
- **51 isolated node(s):** `Profile Page JavaScript Modular Structure (Documentation)`, `mainPage/index.js`, `addFriendForm/addForm.js`, `facts/facts.js`, `Chart.js (CDN)` (+46 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Knowledge Facts UI`** (27 nodes): `KnowledgeManager`, `.addKnowledgeToTable()`, `.addRowToTable()`, `.collectKnowledgeData()`, `.constructor()`, `.createKnowledgeRow()`, `.findInsertionIndex()`, `.getIdFromUrl()`, `.goToPage()`, `.handleDelete()`, `.handleFormSubmit()`, `.handleSubmitInfo()`, `.handleUpdate()`, `.initExistingTableRows()`, `.initializeElements()`, `.initializeEntityId()`, `.initializeEventListeners()`, `.initializePagination()`, `.insertRowSorted()`, `.loadKnowledgePage()`, `.sendKnowledgeData()`, `.showError()`, `.showSuccess()`, `.updateKnowledgeTable()`, `.updatePaginationControls()`, `.updatePaginationInfo()`, `knowledgeManager.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Drag & Drop Handling`** (13 nodes): `DragDropHandler`, `.constructor()`, `.handleDocumentDragEnter()`, `.handleDocumentDragLeave()`, `.handleDocumentDragOver()`, `.handleDocumentDrop()`, `.handleDragEnter()`, `.handleDragLeave()`, `.handleDragOver()`, `.handleDrop()`, `.hasFiles()`, `.init()`, `DragAndDropHandler.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Profile Social Links`** (11 nodes): `socialLinks.js`, `ProfileSocialManager`, `.constructor()`, `.createSocialLinkHTML()`, `.formatUrlForPlatform()`, `.initialize()`, `.loadSocialLinks()`, `.renderEmptyState()`, `.renderError()`, `.renderSocialLinks()`, `.setupEventListeners()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Upload File List Rendering`** (10 nodes): `FileListRenderer`, `.constructor()`, `.createFileItem()`, `.render()`, `FileListRenderer.js`, `FileUtilities.js`, `FileUtilities`, `.formatFileSize()`, `.getFileIcon()`, `.truncateFileName()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Upload Preview Manager`** (8 nodes): `PreviewManager.js`, `PreviewManager`, `.constructor()`, `.generatePreviewContent()`, `.getCurrentFile()`, `.init()`, `.isModalVisible()`, `.show()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Upload File Validation`** (4 nodes): `FileValidator.js`, `FileValidator`, `.constructor()`, `.validateFile()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Favicon 16x16`** (2 nodes): `Favicon (16x16) Image`, `Website Favicon`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Favicon 32x32`** (1 nodes): `Favicon 32×32`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `Text: "FRM"` and `Friendship/relationship theme (human connection)`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **Why does `formatFileSize()` connect `Profile Media Management` to `Upload Preview Manager`, `Upload File List Rendering`?**
  _High betweenness centrality (0.022) - this node is a cross-community bridge._
- **Why does `PreviewManager` connect `Upload Preview Manager` to `File Upload UI`?**
  _High betweenness centrality (0.022) - this node is a cross-community bridge._
- **What connects `Profile Page JavaScript Modular Structure (Documentation)`, `mainPage/index.js`, `addFriendForm/addForm.js` to the rest of the system?**
  _51 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `File Upload UI` be split into smaller, more focused modules?**
  _Cohesion score 0.05 - nodes in this community are weakly interconnected._
- **Should `Form Validation` be split into smaller, more focused modules?**
  _Cohesion score 0.06 - nodes in this community are weakly interconnected._
- **Should `Knowledge Facts UI` be split into smaller, more focused modules?**
  _Cohesion score 0.14 - nodes in this community are weakly interconnected._