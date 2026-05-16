# communicator-core — Navigation Index

Java Spring Boot monolith. All domain flows are documented at the deepest level.

## Domain flows

→ [src/main/java/communicate/FLOWS.md](src/main/java/communicate/FLOWS.md) — domain index

## External dependencies

| Service | Purpose | Config |
|---|---|---|
| PostgreSQL | All JPA entities | `SPRING_DATASOURCE_URL`, `SPRING_DATASOURCE_USERNAME`, `SPRING_DATASOURCE_PASSWORD` |
| ai_agent (Python) | Chat, knowledge summarization, fact extraction | `ai.agent.base-url` (WebClientConfig) |
| resourceRepository (Flask) | File/media storage and retrieval | `file.repository.service.url` (WebClientConfig) |
| nginx | Reverse proxy; static JS served from here | — |
