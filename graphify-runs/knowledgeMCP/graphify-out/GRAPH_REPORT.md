# Graph Report - .  (2026-05-04)

## Corpus Check
- Corpus is ~1,017 words - fits in a single context window. You may not need a graph.

## Summary
- 19 nodes · 19 edges · 5 communities detected
- Extraction: 74% EXTRACTED · 26% INFERRED · 0% AMBIGUOUS · INFERRED: 5 edges (avg confidence: 0.89)
- Token cost: 2 input · 320 output

## Community Hubs (Navigation)
- [[_COMMUNITY_MCP Tool Functions|MCP Tool Functions]]
- [[_COMMUNITY_MCP & HTTP Dependencies|MCP & HTTP Dependencies]]
- [[_COMMUNITY_Analytics Tools|Analytics Tools]]
- [[_COMMUNITY_Moving Average Tools|Moving Average Tools]]
- [[_COMMUNITY_Friends List Tool|Friends List Tool]]

## God Nodes (most connected - your core abstractions)
1. `fastmcp` - 3 edges
2. `knowledgeMCP Module` - 3 edges
3. `get_friend_knowledge()` - 2 edges
4. `create_friend_knowledge()` - 2 edges
5. `update_friend_knowledge()` - 2 edges
6. `get_friend_analytics()` - 2 edges
7. `calculate_friend_moving_averages()` - 2 edges
8. `get_friends_list()` - 2 edges
9. `knowledgeMCP Requirements` - 2 edges
10. `requests` - 2 edges

## Surprising Connections (you probably didn't know these)
- None detected - all connections are within the same source files.

## Communities

### Community 0 - "MCP Tool Functions"
Cohesion: 0.29
Nodes (6): create_friend_knowledge(), get_friend_knowledge(), Retrieve paginated knowledge/facts about a specific friend from the knowledge da, Create a new knowledge/fact entry for a specific friend.          Args:, Update an existing knowledge/fact entry by its ID.          Args:         kno, update_friend_knowledge()

### Community 1 - "MCP & HTTP Dependencies"
Cohesion: 0.47
Nodes (6): HTTP Client, Model Context Protocol (MCP), fastmcp, requests, knowledgeMCP Requirements, knowledgeMCP Module

### Community 2 - "Analytics Tools"
Cohesion: 1.0
Nodes (2): get_friend_analytics(), Retrieve analytics data for a specific friend showing meeting dates and experien

### Community 3 - "Moving Average Tools"
Cohesion: 1.0
Nodes (2): calculate_friend_moving_averages(), Get exponential moving averages for friend interaction metrics.          Args:

### Community 4 - "Friends List Tool"
Cohesion: 1.0
Nodes (2): get_friends_list(), Retrieve a paginated list of friends with basic information.          Args:

## Knowledge Gaps
- **6 isolated node(s):** `Retrieve paginated knowledge/facts about a specific friend from the knowledge da`, `Create a new knowledge/fact entry for a specific friend.          Args:`, `Update an existing knowledge/fact entry by its ID.          Args:         kno`, `Retrieve analytics data for a specific friend showing meeting dates and experien`, `Get exponential moving averages for friend interaction metrics.          Args:` (+1 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Analytics Tools`** (2 nodes): `get_friend_analytics()`, `Retrieve analytics data for a specific friend showing meeting dates and experien`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Moving Average Tools`** (2 nodes): `calculate_friend_moving_averages()`, `Get exponential moving averages for friend interaction metrics.          Args:`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Friends List Tool`** (2 nodes): `get_friends_list()`, `Retrieve a paginated list of friends with basic information.          Args:`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Are the 2 inferred relationships involving `fastmcp` (e.g. with `knowledgeMCP Module` and `Model Context Protocol (MCP)`) actually correct?**
  _`fastmcp` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Are the 3 inferred relationships involving `knowledgeMCP Module` (e.g. with `fastmcp` and `Model Context Protocol (MCP)`) actually correct?**
  _`knowledgeMCP Module` has 3 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Retrieve paginated knowledge/facts about a specific friend from the knowledge da`, `Create a new knowledge/fact entry for a specific friend.          Args:`, `Update an existing knowledge/fact entry by its ID.          Args:         kno` to the rest of the system?**
  _6 weakly-connected nodes found - possible documentation gaps or missing edges._