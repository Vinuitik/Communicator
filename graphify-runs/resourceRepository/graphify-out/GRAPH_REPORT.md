# Graph Report - .  (2026-05-04)

## Corpus Check
- Corpus is ~1,850 words - fits in a single context window. You may not need a graph.

## Summary
- 52 nodes · 70 edges · 8 communities detected
- Extraction: 79% EXTRACTED · 21% INFERRED · 0% AMBIGUOUS · INFERRED: 15 edges (avg confidence: 0.81)
- Token cost: 780 input · 950 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Backup Service|Backup Service]]
- [[_COMMUNITY_Transactional File Ops|Transactional File Ops]]
- [[_COMMUNITY_Friends File Handlers|Friends File Handlers]]
- [[_COMMUNITY_Groups File Handlers|Groups File Handlers]]
- [[_COMMUNITY_Backup & Connections API|Backup & Connections API]]
- [[_COMMUNITY_Friends & Groups API|Friends & Groups API]]
- [[_COMMUNITY_Flask App Entry|Flask App Entry]]
- [[_COMMUNITY_Dev Dependencies|Dev Dependencies]]

## God Nodes (most connected - your core abstractions)
1. `find_file_path()` - 7 edges
2. `save_files_transactional()` - 6 edges
3. `delete_files_transactional()` - 6 edges
4. `blueprints/ Directory` - 5 edges
5. `get_destination_folder()` - 4 edges
6. `Flask Resource Repository Microservice` - 4 edges
7. `app.py - Main Entry Point` - 4 edges
8. `Transactional File Operations` - 4 edges
9. `RESOURCE_FOLDERS Directory Structure Config` - 4 edges
10. `Friends API Endpoints (/)` - 4 edges

## Surprising Connections (you probably didn't know these)
- `serve_file_connection()` --calls--> `find_file_path()`  [INFERRED]
  C:\Users\ACER\Desktop\Java\Communicator\resourceRepository\flask-template\blueprints\connections_files.py → C:\Users\ACER\Desktop\Java\Communicator\resourceRepository\flask-template\app.py
- `serve_file_friend()` --calls--> `find_file_path()`  [INFERRED]
  C:\Users\ACER\Desktop\Java\Communicator\resourceRepository\flask-template\blueprints\friends_files.py → C:\Users\ACER\Desktop\Java\Communicator\resourceRepository\flask-template\app.py
- `serve_file_group()` --calls--> `find_file_path()`  [INFERRED]
  C:\Users\ACER\Desktop\Java\Communicator\resourceRepository\flask-template\blueprints\groups_files.py → C:\Users\ACER\Desktop\Java\Communicator\resourceRepository\flask-template\app.py
- `upload_files_connection()` --calls--> `save_files_transactional()`  [INFERRED]
  C:\Users\ACER\Desktop\Java\Communicator\resourceRepository\flask-template\blueprints\connections_files.py → C:\Users\ACER\Desktop\Java\Communicator\resourceRepository\flask-template\app.py
- `upload_files_friend()` --calls--> `save_files_transactional()`  [INFERRED]
  C:\Users\ACER\Desktop\Java\Communicator\resourceRepository\flask-template\blueprints\friends_files.py → C:\Users\ACER\Desktop\Java\Communicator\resourceRepository\flask-template\app.py

## Communities

### Community 0 - "Backup Service"
Cohesion: 0.18
Nodes (8): backup_all_files(), Creates a zip archive of all files for friends, groups, and connections., delete_files_connection(), Handles file uploads for a specific connection., Serves an individual file for a specific connection., Deletes specific files for a connection., serve_file_connection(), upload_files_connection()

### Community 1 - "Transactional File Ops"
Cohesion: 0.31
Nodes (8): delete_files_transactional(), find_file_path(), get_destination_folder(), Deletes specific files for an entity as a transaction., Determines the destination folder based on file extension, entity type, and ID., Searches for a file in the specific entity's resource directory., Saves one or more files with rollback on failure., save_files_transactional()

### Community 2 - "Friends File Handlers"
Cohesion: 0.29
Nodes (6): delete_files_friend(), Handles file uploads for a specific friend., Serves an individual file for a specific friend., Deletes specific files for a friend., serve_file_friend(), upload_files_friend()

### Community 3 - "Groups File Handlers"
Cohesion: 0.29
Nodes (6): delete_files_group(), Handles file uploads for a specific group., Serves an individual file for a specific group., Deletes specific files for a group., serve_file_group(), upload_files_group()

### Community 4 - "Backup & Connections API"
Cohesion: 0.4
Nodes (6): Backup API Endpoint (/backup), Connections API Endpoints (/connections), backup.py Blueprint, blueprints/ Directory, connections_files.py Blueprint, friends_files.py Blueprint

### Community 5 - "Friends & Groups API"
Cohesion: 0.5
Nodes (5): Friends API Endpoints (/), Groups API Endpoints (/groups), groups_files.py Blueprint, RESOURCE_FOLDERS Directory Structure Config, Transactional File Operations

### Community 6 - "Flask App Entry"
Cohesion: 0.67
Nodes (4): app.py - Main Entry Point, Flask (Dependency), Flask-Compress (Dependency), Flask Resource Repository Microservice

### Community 7 - "Dev Dependencies"
Cohesion: 0.67
Nodes (1): pytest (Dev Dependency)

## Knowledge Gaps
- **16 isolated node(s):** `Determines the destination folder based on file extension, entity type, and ID.`, `Searches for a file in the specific entity's resource directory.`, `Saves one or more files with rollback on failure.`, `Deletes specific files for an entity as a transaction.`, `Creates a zip archive of all files for friends, groups, and connections.` (+11 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Dev Dependencies`** (3 nodes): `pytest (Dev Dependency)`, `dev-requirements.txt`, `requirements.txt`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `find_file_path()` connect `Transactional File Ops` to `Backup Service`, `Friends File Handlers`, `Groups File Handlers`?**
  _High betweenness centrality (0.113) - this node is a cross-community bridge._
- **Why does `delete_files_transactional()` connect `Transactional File Ops` to `Backup Service`, `Friends File Handlers`, `Groups File Handlers`?**
  _High betweenness centrality (0.098) - this node is a cross-community bridge._
- **Why does `save_files_transactional()` connect `Transactional File Ops` to `Backup Service`, `Friends File Handlers`, `Groups File Handlers`?**
  _High betweenness centrality (0.092) - this node is a cross-community bridge._
- **Are the 3 inferred relationships involving `find_file_path()` (e.g. with `serve_file_connection()` and `serve_file_friend()`) actually correct?**
  _`find_file_path()` has 3 INFERRED edges - model-reasoned connections that need verification._
- **Are the 3 inferred relationships involving `save_files_transactional()` (e.g. with `upload_files_connection()` and `upload_files_friend()`) actually correct?**
  _`save_files_transactional()` has 3 INFERRED edges - model-reasoned connections that need verification._
- **Are the 3 inferred relationships involving `delete_files_transactional()` (e.g. with `delete_files_connection()` and `delete_files_friend()`) actually correct?**
  _`delete_files_transactional()` has 3 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Determines the destination folder based on file extension, entity type, and ID.`, `Searches for a file in the specific entity's resource directory.`, `Saves one or more files with rollback on failure.` to the rest of the system?**
  _16 weakly-connected nodes found - possible documentation gaps or missing edges._