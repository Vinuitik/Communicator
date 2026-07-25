# Code-Reuse / Consolidation Report

Where Communicator repeats itself, ranked by pain. Each item: the duplication, the evidence, why it hurts, and a consolidation move. Written from the [protos](FLOWS.md) — every file reference is real.

**TL;DR:** the same *relationship-health math* exists **4 times** in 3 languages; the same *Spring "entity + knowledge + permission + social + media" stack* exists **3 times** (one an empty clone); the same *Flask media handler* exists **3 times**; and there are **3 separate HTTP clients** to the friend service using **2 different routings**. None of it is DRY, and the copies have already drifted.

---

## 1. ⚠️ EMA / moving-average math — FOUR copies, already drifted  `[highest priority]`

The "relationship health" algorithm is reimplemented independently in four places:

| # | Location | Lang | Role | Coefficients |
|---|---|---|---|---|
| 1 | `friend/…/FriendService/EmaUpdateService.java` | Java | EMA **up** on each interaction | new-data α: `*`=.8 `**`=.7 `***`=.6; decay k=0.1, 12-day window |
| 2 | `chrono/…/service/ChronoJobService.applyDecayToFriend` | Java | EMA **down** nightly | hardcoded α=0.2 ("good") — **ignores rating** |
| 3 | `chrono/…/service/MovingAverageCalculationService` | Java | full replay recompute | `getNewDataAlpha`: `**`=.3 `*`=.15 (**≠ #1**); `getDecayAlpha`: .07/.2/.57 — **and it's unwired** |
| 4 | `knowledgeMCP/knowledgeMCP.py calculate_friend_moving_averages` | Python | recompute for MCP | its own copy |
| (+) | frontend `static/analytics/analytics.js` | JS | the "original" the others cite | its own copy |

**Why it hurts:** the number a user sees for a friend depends on *which path last wrote it*, and the coefficients already disagree (#1 vs #3). #3 is dead code; #2 silently ignores the experience rating it's configured to respect.

**Consolidation:** pick **one owner** of the algorithm. Cleanest: the **friend service owns EMA end-to-end** — move the nightly decay INTO friend as a `@Scheduled` job (or an endpoint chrono triggers), delete `MovingAverageCalculationService`, and have chrono become a pure *trigger* (or delete it — see §4). Replace the MCP Python copy with a call to a friend endpoint (`GET /friends/{id}/averages`). Single coefficient source (`EmaProperties`). See the [relationship-lifecycle flow](flows/relationship-lifecycle.md).

---

## 2. ~~Three Spring "domain stacks" — friend / group / connections~~ RESOLVED (Knowledge/Permission) 2026-07-25  `[high]`

friend, group, and connections were the **same architecture cloned three times**: an aggregate root + `Knowledge`, `Permission`, `Social`, `Photo`/`Video`/`Resource` children, each with Controller → Service → Repository → Entity, the same `@CrossOrigin(origins="http://nginx")`, the same knowledge-pagination-by-priority, the same swallow-and-`System.out.print` error handling, the same media-proxy-to-fileRepository.

**Resolved for Knowledge/Permission**: extracted a shared Maven module, `knowledge-core` (`AbstractFact` `@MappedSuperclass` + `AbstractFactService<T,ID>`). friend/group's `*Knowledge`/`*Permission` entities+services now extend it; connections — previously an **empty clone** (controllers/services were bare classes) — is now *implemented for real* on the same base, including a proper `ConnectionsController`/`ConnectionsPermissionController` and a full React UI (list/create/details pages). See [knowledge-core/PROTO.md](knowledge-core/src/main/java/com/communicator/knowledgecore/PROTO.md), [connections/PROTO.md](connections/src/main/java/coommunicator/connections/Connections/PROTO.md).

**Not resolved**: Social (`Social`/`GroupSocial`) and media (`Photos`/`Videos`/`PersonalResource` vs `GroupPhoto`/`GroupVideo`/`GroupResource`) are the same shape of duplication, deliberately left out of this pass — see knowledge-core/PROTO.md's "What's deliberately NOT generalized."

---

## 3. Three Flask media blueprints — friends / groups / connections  `[medium]`

`resourceRepository/flask-template/blueprints/{friends,groups,connections}_files.py` are identical except the `entity_type` string and route names (all delegate to the shared engine in `app.py`). Evidence: [resourceRepository proto §Gotchas](resourceRepository/flask-template/PROTO.md).

**Consolidation:** one **blueprint factory** — `make_entity_blueprint(entity_type)` — registered three times. ~120 lines → ~40. Low risk (the hard logic already lives in `app.py`).

---

## 4. Three HTTP clients to the friend service, two routings — chrono leg RESOLVED 2026-07-25  `[medium]`

The friend API used to be consumed by three hand-rolled clients with **no shared contract**:

| Client | Lib | Routing to friend |
|---|---|---|
| ~~`chrono/…/FriendServiceClient`~~ | ~~`java.net.http`~~ | **now a direct Spring bean injection — no HTTP at all** (chrono+friend share a JVM since the monolith merge; `FriendServiceClient` deleted) |
| `ai_agent/services/friend_api_service.py` | `aiohttp` | **direct** (`http://friend:8085`) |
| `knowledgeMCP.py` (each tool) | `requests` | via **nginx** |

**Why it hurts (still, for the remaining two):** the same endpoints are reached two different ways, and each client re-implements timeout/error handling (both swallow errors → empty results). Endpoint drift in friend breaks callers silently.

**Consolidation done:** chrono no longer needs a routing decision — it's in-process now (see [bootstrap FLOWS §Technology Notes](bootstrap/FLOWS.md), [chrono/PROTO.md](chrono/src/main/java/com/communicator/chrono/PROTO.md)). **Still open:** ai_agent (direct) vs knowledgeMCP (nginx) still disagree — pick one convention for those two (recommend direct `friend:8085`, nginx is for browser ingress).

---

## 5. Duplicated / hardcoded DB credentials  `[medium — security]`

`myapp_user`/`example` + DB URL appear in: compose env for friend/group/connections **and** as **hardcoded Java constants** in `backup/PostgresBackupService.java`. Evidence: [backup proto §Gotchas](backup/PROTO.md).

**Why it hurts:** rotating the DB password silently breaks backups (constant, not env). Secrets in source. **These are real credentials** committed to the repo.

**Consolidation:** single source via env/`.env` (or Docker secrets); make backup read `SPRING_DATASOURCE_*`/`PG*` env like everyone else. Move `service-account-key.json` (backup + ai_agent both bake one) out of the image into a mounted secret.

---

## 6. ~~Three overlapping vector/embedding systems~~ RESOLVED (2026-07-23)  `[low–medium, architectural]`

Used to run **pgvector** (Postgres image, provisioned but unused by the Spring side), **FAISS** (ai_agent `SearchService`, in-RAM), and **Ollama embeddings + Mongo chunk storage** (ai_agent) — three ways to do similarity search, none of them actually shared. Consolidated: Postgres image swapped to **ParadeDB** (adds `pg_search` BM25 alongside pgvector), ai_agent's chunks/embeddings moved into that same instance, FAISS removed entirely, embeddings now come from a standalone ONNX EmbeddingGemma service instead of Ollama, search is hybrid pgvector + BM25 fused via RRF. One store, one index, Spring services *could* now query the same vectors if a use case for that ever appears. Evidence: [ai_agent proto §Gotchas](ai_agent/PROTO.md), [embedder proto](embedder/PROTO.md), [knowledge-rag flow](flows/knowledge-rag.md).

---

## 7. Repeated anti-patterns (not code you can extract, but worth standardizing)  `[low]`

- **Swallow-and-print error handling** in nearly every Java service method (`try { … } catch (Exception e) { System.out.print(...) }` → return empty/null). A failed read is indistinguishable from "no data." Standardize on a shared exception handler + real logging (chrono/ai_agent already use SLF4J; friend/group use `System.out`).
- ~~**Field-merge-on-update** reimplemented differently per service~~ RESOLVED for Knowledge/Permission 2026-07-25 — standardized on fetch-and-merge (text/priority only) via `AbstractFactService.update()`. Fixed a real bug along the way: friend's old blind-overwrite nulled `reviewDate`/`interval` on every edit.
- ~~**Knowledge pagination (priority DESC, size 10)** duplicated in friend + group~~ RESOLVED — `AbstractFactService.priorityPage()`.

---

## Suggested order of attack

1. ~~**§1 EMA**~~ DONE (scoped down — see [[communicator-code-reuse-progress]] memory for what changed vs. the original ask).
2. ~~**§5 credentials**~~ DONE (consolidated, not rotated — real rotation still needs a live `ALTER ROLE` + restarts, explicit go-ahead required).
3. ~~**§3 Flask factory**~~ DONE.
4. ~~**§2 Spring shared module**~~ DONE for Knowledge/Permission, including implementing connections for real. Social/media duplication remains, deliberately out of scope.
5. ~~**§4 friend-client unification**~~ DONE for the chrono leg (eliminated, not just re-routed). ai_agent vs knowledgeMCP routing still open.
6. **§6 vectors** — revisit once the AI pipeline stabilizes.

Every claim here is anchored in a `PROTO.md`; open the linked proto for the exact method/line before refactoring.
