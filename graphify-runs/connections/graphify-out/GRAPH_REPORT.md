# Graph Report - .  (2026-05-04)

## Corpus Check
- Corpus is ~421 words - fits in a single context window. You may not need a graph.

## Summary
- 30 nodes · 18 edges · 13 communities detected
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Application Entry Point|Application Entry Point]]
- [[_COMMUNITY_Connection Entity|Connection Entity]]
- [[_COMMUNITY_Connection Identity|Connection Identity]]
- [[_COMMUNITY_Test Suite|Test Suite]]
- [[_COMMUNITY_REST Controller|REST Controller]]
- [[_COMMUNITY_Permission Entity|Permission Entity]]
- [[_COMMUNITY_Knowledge Entity|Knowledge Entity]]
- [[_COMMUNITY_Knowledge Service|Knowledge Service]]
- [[_COMMUNITY_Permission Service|Permission Service]]
- [[_COMMUNITY_Connection Service|Connection Service]]
- [[_COMMUNITY_Permission Repository|Permission Repository]]
- [[_COMMUNITY_Connection Repository|Connection Repository]]
- [[_COMMUNITY_Knowledge Repository|Knowledge Repository]]

## God Nodes (most connected - your core abstractions)
1. `ConnectionsApplication` - 2 edges
2. `Connection` - 2 edges
3. `ConnectionId` - 2 edges
4. `ConnectionsApplicationTests` - 2 edges
5. `ConnectionsController` - 1 edges
6. `ConnectionPermission` - 1 edges
7. `ConnectionsKnowledge` - 1 edges
8. `ConnectionKnowledgeService` - 1 edges
9. `ConnectionPermissionService` - 1 edges
10. `ConnectionService` - 1 edges

## Surprising Connections (you probably didn't know these)
- None detected - all connections are within the same source files.

## Communities

### Community 0 - "Application Entry Point"
Cohesion: 0.67
Nodes (1): ConnectionsApplication

### Community 1 - "Connection Entity"
Cohesion: 0.67
Nodes (1): Connection

### Community 2 - "Connection Identity"
Cohesion: 1.0
Nodes (2): ConnectionId, Serializable

### Community 3 - "Test Suite"
Cohesion: 0.67
Nodes (1): ConnectionsApplicationTests

### Community 4 - "REST Controller"
Cohesion: 1.0
Nodes (1): ConnectionsController

### Community 5 - "Permission Entity"
Cohesion: 1.0
Nodes (1): ConnectionPermission

### Community 6 - "Knowledge Entity"
Cohesion: 1.0
Nodes (1): ConnectionsKnowledge

### Community 7 - "Knowledge Service"
Cohesion: 1.0
Nodes (1): ConnectionKnowledgeService

### Community 8 - "Permission Service"
Cohesion: 1.0
Nodes (1): ConnectionPermissionService

### Community 9 - "Connection Service"
Cohesion: 1.0
Nodes (1): ConnectionService

### Community 10 - "Permission Repository"
Cohesion: 1.0
Nodes (1): ConnectionPermissionRepository

### Community 11 - "Connection Repository"
Cohesion: 1.0
Nodes (1): ConnectionRepository

### Community 12 - "Knowledge Repository"
Cohesion: 1.0
Nodes (1): ConnectionsKnowledgeRepository

## Knowledge Gaps
- **9 isolated node(s):** `ConnectionsController`, `ConnectionPermission`, `ConnectionsKnowledge`, `ConnectionKnowledgeService`, `ConnectionPermissionService` (+4 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Application Entry Point`** (3 nodes): `ConnectionsApplication`, `.main()`, `ConnectionsApplication.java`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Connection Entity`** (3 nodes): `Connection`, `.Connection()`, `Connection.java`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Connection Identity`** (3 nodes): `ConnectionId`, `ConnectionId.java`, `Serializable`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Test Suite`** (3 nodes): `ConnectionsApplicationTests`, `.contextLoads()`, `ConnectionsApplicationTests.java`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `REST Controller`** (2 nodes): `ConnectionsController`, `ConnectionsController.java`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Permission Entity`** (2 nodes): `ConnectionPermission`, `ConnectionPermission.java`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Knowledge Entity`** (2 nodes): `ConnectionsKnowledge`, `ConnectionsKnowledge.java`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Knowledge Service`** (2 nodes): `ConnectionKnowledgeService`, `ConnectionKnowledgeService.java`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Permission Service`** (2 nodes): `ConnectionPermissionService`, `ConnectionPermissionService.java`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Connection Service`** (2 nodes): `ConnectionService`, `ConnectionService.java`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Permission Repository`** (2 nodes): `ConnectionPermissionRepository`, `ConnectionPermissionRepository.java`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Connection Repository`** (2 nodes): `ConnectionRepository`, `ConnectionRepository.java`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Knowledge Repository`** (2 nodes): `ConnectionsKnowledgeRepository`, `ConnectionsKnowledgeRepository.java`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What connects `ConnectionsController`, `ConnectionPermission`, `ConnectionsKnowledge` to the rest of the system?**
  _9 weakly-connected nodes found - possible documentation gaps or missing edges._