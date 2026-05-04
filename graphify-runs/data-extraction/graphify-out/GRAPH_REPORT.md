# Graph Report - .  (2026-05-04)

## Corpus Check
- Corpus is ~776 words - fits in a single context window. You may not need a graph.

## Summary
- 39 nodes · 41 edges · 6 communities detected
- Extraction: 78% EXTRACTED · 22% INFERRED · 0% AMBIGUOUS · INFERRED: 9 edges (avg confidence: 0.87)
- Token cost: 1,050 input · 920 output

## Community Hubs (Navigation)
- [[_COMMUNITY_API Endpoints|API Endpoints]]
- [[_COMMUNITY_FastAPI Stack|FastAPI Stack]]
- [[_COMMUNITY_Service Structure & Dev Tools|Service Structure & Dev Tools]]
- [[_COMMUNITY_Communicator Microservices|Communicator Microservices]]
- [[_COMMUNITY_Layered Architecture Dirs|Layered Architecture Dirs]]
- [[_COMMUNITY_Build & Run Scripts|Build & Run Scripts]]

## God Nodes (most connected - your core abstractions)
1. `Data Extraction Service` - 15 edges
2. `FastAPI Application (main.py)` - 5 edges
3. `Communicator Monorepo` - 5 edges
4. `Python Requirements File (requirements.txt)` - 5 edges
5. `prototype()` - 3 edges
6. `Python Virtual Environment (venv)` - 3 edges
7. `Repositories / Data Access Layer (repositories/)` - 3 edges
8. `Business Logic Directory (services/)` - 3 edges
9. `llama-index (Python Dependency)` - 3 edges
10. `extract_web_data()` - 2 edges

## Surprising Connections (you probably didn't know these)
- `FastAPI Application (main.py)` --implements--> `FastAPI (Python Dependency)`  [INFERRED]
  data-extraction/README.md → data-extraction/app/requirements.txt
- `FastAPI Application (main.py)` --implements--> `Uvicorn ASGI Server (Python Dependency)`  [INFERRED]
  data-extraction/README.md → data-extraction/app/requirements.txt
- `FastAPI Application (main.py)` --implements--> `Pydantic (Python Dependency)`  [INFERRED]
  data-extraction/README.md → data-extraction/app/requirements.txt
- `AI Prompts Directory (prompts/)` --conceptually_related_to--> `llama-index (Python Dependency)`  [INFERRED]
  data-extraction/README.md → data-extraction/app/requirements.txt
- `FastAPI Application (main.py)` --implements--> `llama-index (Python Dependency)`  [INFERRED]
  data-extraction/README.md → data-extraction/app/requirements.txt

## Communities

### Community 0 - "API Endpoints"
Cohesion: 0.29
Nodes (5): extract_web_data(), main(), prototype(), Extract data from a web page, Prototype function for testing

### Community 1 - "FastAPI Stack"
Cohesion: 0.53
Nodes (6): FastAPI Application (main.py), Python Requirements File (requirements.txt), FastAPI (Python Dependency), llama-index (Python Dependency), Pydantic (Python Dependency), Uvicorn ASGI Server (Python Dependency)

### Community 2 - "Service Structure & Dev Tools"
Cohesion: 0.4
Nodes (5): Configuration Directory (config/), Data Extraction Service, Development Helper (dev.sh), AI Prompts Directory (prompts/), Utility Functions Directory (utils/)

### Community 3 - "Communicator Microservices"
Cohesion: 0.4
Nodes (5): AI Agent Microservice, Communicator Monorepo, Connections Microservice, Multi-Level GitIgnore Hierarchy, Group Microservice

### Community 4 - "Layered Architecture Dirs"
Cohesion: 0.5
Nodes (4): Data Models Directory (models/), Repositories / Data Access Layer (repositories/), API Routes Directory (routers/), Business Logic Directory (services/)

### Community 5 - "Build & Run Scripts"
Cohesion: 0.67
Nodes (3): Makefile, Run Script (run.sh), Python Virtual Environment (venv)

## Knowledge Gaps
- **8 isolated node(s):** `Extract data from a web page`, `Prototype function for testing`, `Development Helper (dev.sh)`, `Configuration Directory (config/)`, `Utility Functions Directory (utils/)` (+3 more)
  These have ≤1 connection - possible missing edges or undocumented components.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Data Extraction Service` connect `Service Structure & Dev Tools` to `FastAPI Stack`, `Communicator Microservices`, `Layered Architecture Dirs`, `Build & Run Scripts`?**
  _High betweenness centrality (0.279) - this node is a cross-community bridge._
- **Why does `Communicator Monorepo` connect `Communicator Microservices` to `Service Structure & Dev Tools`?**
  _High betweenness centrality (0.085) - this node is a cross-community bridge._
- **Why does `FastAPI Application (main.py)` connect `FastAPI Stack` to `Service Structure & Dev Tools`?**
  _High betweenness centrality (0.048) - this node is a cross-community bridge._
- **Are the 4 inferred relationships involving `FastAPI Application (main.py)` (e.g. with `FastAPI (Python Dependency)` and `Uvicorn ASGI Server (Python Dependency)`) actually correct?**
  _`FastAPI Application (main.py)` has 4 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Extract data from a web page`, `Prototype function for testing`, `Development Helper (dev.sh)` to the rest of the system?**
  _8 weakly-connected nodes found - possible documentation gaps or missing edges._