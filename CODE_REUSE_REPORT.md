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

## 2. Three Spring "domain stacks" — friend / group / connections  `[high]`

friend, group, and connections are the **same architecture cloned three times**: an aggregate root + `Knowledge`, `Permission`, `Social`, `Photo`/`Video`/`Resource` children, each with Controller → Service → Repository → Entity, the same `@CrossOrigin(origins="http://nginx")`, the same knowledge-pagination-by-priority, the same swallow-and-`System.out.print` error handling, the same media-proxy-to-fileRepository.

Evidence: [group proto §Gotchas](group/src/main/java/com/example/demo/Group/PROTO.md) ("near-clone of friend"), [connections proto](connections/src/main/java/coommunicator/connections/Connections/PROTO.md) (empty clone — controllers/services are stubs). Even the package names betray the copy-paste lineage: `communicate.Friend`, `com.example.demo.Group`, `coommunicator.connections` (note the typo).

**Why it hurts:** every knowledge/permission/social feature is built 2–3×; connections was started by cloning and abandoned half-done; a fix to (say) the JSON reference-cycle handling must be applied in three places.

**Consolidation:** extract a **shared Maven module** — `communicator-knowledge-core` — holding the generic `Knowledge`/`Permission`/`Social`/media entities + base service/repository (generics or `@MappedSuperclass`). Each service parameterizes the owner (`Friend`/`SocialGroup`/`Connection`). This alone would let connections be *implemented* by wiring, not cloning. Standardize the base package + error handling while you're in there.

---

## 3. Three Flask media blueprints — friends / groups / connections  `[medium]`

`resourceRepository/flask-template/blueprints/{friends,groups,connections}_files.py` are identical except the `entity_type` string and route names (all delegate to the shared engine in `app.py`). Evidence: [resourceRepository proto §Gotchas](resourceRepository/flask-template/PROTO.md).

**Consolidation:** one **blueprint factory** — `make_entity_blueprint(entity_type)` — registered three times. ~120 lines → ~40. Low risk (the hard logic already lives in `app.py`).

---

## 4. Three HTTP clients to the friend service, two routings  `[medium]`

The friend API is consumed by three hand-rolled clients with **no shared contract**:

| Client | Lib | Routing to friend |
|---|---|---|
| `chrono/…/FriendServiceClient` | `java.net.http` | via **nginx** (`http://nginx/api/friend`) |
| `ai_agent/services/friend_api_service.py` | `aiohttp` | **direct** (`http://friend:8085`) |
| `knowledgeMCP.py` (each tool) | `requests` | via **nginx** |

**Why it hurts:** the same endpoints are reached two different ways (one more variable when debugging a failed call), and each client re-implements timeout/error handling (all three just swallow errors → empty results). Endpoint drift in friend breaks callers silently.

**Consolidation:** (a) **pick one routing convention** — recommend **direct `friend:8085`** for internal service-to-service (nginx is for browser ingress, not east-west traffic), and update chrono + MCP. (b) Publish the friend knowledge/analytics API as a tiny typed client per language, or better, let the MCP server be the *single* friend-knowledge gateway that ai_agent and chrono both call (MCP already wraps most of it).

---

## 5. Duplicated / hardcoded DB credentials  `[medium — security]`

`myapp_user`/`example` + DB URL appear in: compose env for friend/group/connections **and** as **hardcoded Java constants** in `backup/PostgresBackupService.java`. Evidence: [backup proto §Gotchas](backup/PROTO.md).

**Why it hurts:** rotating the DB password silently breaks backups (constant, not env). Secrets in source. **These are real credentials** committed to the repo.

**Consolidation:** single source via env/`.env` (or Docker secrets); make backup read `SPRING_DATASOURCE_*`/`PG*` env like everyone else. Move `service-account-key.json` (backup + ai_agent both bake one) out of the image into a mounted secret.

---

## 6. Three overlapping vector/embedding systems  `[low–medium, architectural]`

The stack runs **pgvector** (Postgres image, for the Spring side), **FAISS** (ai_agent `SearchService`), and **Ollama embeddings + Mongo chunk storage** (ai_agent) — three ways to do similarity search. Evidence: [ai_agent proto §Gotchas](ai_agent/PROTO.md).

**Consolidation:** decide the system of record for vectors. Since Postgres already has **pgvector**, the ai_agent could store chunk embeddings there instead of FAISS+Mongo, collapsing two stores into one and giving the Spring services access to the same index. Bigger project — flag, don't rush.

---

## 7. Repeated anti-patterns (not code you can extract, but worth standardizing)  `[low]`

- **Swallow-and-print error handling** in nearly every Java service method (`try { … } catch (Exception e) { System.out.print(...) }` → return empty/null). A failed read is indistinguishable from "no data." Standardize on a shared exception handler + real logging (chrono/ai_agent already use SLF4J; friend/group use `System.out`).
- **Field-merge-on-update** reimplemented differently per service (friend null-guards, group blind-overwrites). Pick one semantic.
- **Knowledge pagination (priority DESC, size 10)** duplicated in friend + group knowledge services → falls out of §2 if that's done.

---

## Suggested order of attack

1. **§1 EMA** — highest correctness risk, self-contained; make friend the sole owner, gut chrono's copies.
2. **§5 credentials** — quick + security win.
3. **§3 Flask factory** — cheap, low risk, satisfying.
4. **§2 Spring shared module** — biggest structural win; also *unblocks implementing connections* instead of cloning it.
5. **§4 friend-client unification** — do alongside §2.
6. **§6 vectors** — revisit once the AI pipeline stabilizes.

Every claim here is anchored in a `PROTO.md`; open the linked proto for the exact method/line before refactoring.
