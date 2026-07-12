# JVM Monolith — Assembly & Routing
Files: pom.xml (root aggregator), bootstrap/pom.xml, bootstrap/src/main/java/com/communicator/app/CommunicatorApplication.java, bootstrap/src/main/java/com/communicator/app/PathPrefixConfig.java, bootstrap/src/main/resources/application.yml, Dockerfile, docker-compose.yml (communicator-app), nginx/nginx.conf

The five former JVM microservices (**friend, group, connections, chrono, backup**) are one deployable: a Maven **multi-module modular monolith**, one JVM at runtime, business boundaries enforced at the module level. This file is the map of *how they were merged* — the parts that are not obvious from reading any single module.

## Module layout
```
communicator-parent (root pom.xml, packaging=pom, inherits spring-boot-starter-parent 3.2.1, java 21)
├── friend        (library jar) — base pkg communicate.*        (JPA)
├── group         (library jar) — base pkg com.example.demo.*   (JPA + app-wide security)
├── connections   (library jar) — base pkg coommunicator.connections.* (JPA; controllers are a stub)
├── chrono        (library jar) — base pkg com.communicator.chrono.*  (scheduled jobs, no JPA)
├── backup        (library jar) — base pkg communicate.backup.* (JPA; Drive OAuth)
└── bootstrap     (the ONLY executable: @SpringBootApplication + fat jar `app.jar`)
```
Only `bootstrap` has `spring-boot-maven-plugin` (repackage). Every other module is a plain library jar with no `main`. To add/refold a module: add its dep in `bootstrap/pom.xml` + its base package to the scan lists in `CommunicatorApplication`.

## Boot / component wiring
`CommunicatorApplication` (single `@SpringBootApplication`) drives everything:
- `scanBasePackages` → all five base packages. **Gotcha:** backup lives at `communicate.backup`, a *sub-package* of friend's `communicate`, so scanning `communicate` already covers backup — backup is not listed separately.
- `@EntityScan` / `@EnableJpaRepositories` → `communicate` (friend+backup), `com.example.demo` (group), `coommunicator.connections`. chrono is absent (no entities).
- `@EnableScheduling` → serves **both** chrono's nightly decay and backup's cron. `@EnableConfigurationProperties` → friend `EmaProperties`, chrono `ChronoProperties` (both self-register via `@Component`).
- All modules share **one persistence context** against one Postgres. This works only because entity class names never collide (Friend* / Group* / Connection* / BackupSetting) → distinct default tables.

To change what's scanned: `CommunicatorApplication.SCAN/@EntityScan/@EnableJpaRepositories` lists.

## Request routing — the important part
Standalone, each service owned the **root** path namespace (nginx stripped `/api/<svc>/`), so friend and group both map e.g. `PUT /updateKnowledge`, `POST /addKnowledge/{id}`. Merged into one dispatcher those are **ambiguous mappings → app won't start**.

Fix = **per-module URL prefixes**, applied without editing every controller:

`PathPrefixConfig.configurePathMatch()` → `addPathPrefix(prefix, packagePredicate)`:
- `communicate.*` (minus `communicate.backup`) → `/api/friend`
- `com.example.demo.*` → `/api/groups`
- `coommunicator.connections.*` → `/api/connections`
- chrono (`/chrono`) and backup (`/backup`) are **left unprefixed** — they already carry class-level prefixes.

Browser → nginx → app, path preserved end to end:
```
/api/friend/allFriends → nginx (location /api/friend/, NO strip) → app → PathPrefixConfig makes friend ctrls /api/friend/** → 200
```
**Coupling:** the nginx `proxy_pass` for friend/groups/connections has **no trailing slash** (preserve prefix). If you re-add the slash, nginx strips the prefix and every friend/group/connections route 404s. `To change a module's public prefix: PathPrefixConfig + the matching nginx location must move together.`

`GroupFileController` was class-mapped `/api/groups`; changed to `""` so the prefix supplies it (else it would double to `/api/groups/api/groups`).

## Bean-name collisions resolved
Two `@Configuration` simple-names existed in both friend and group → duplicate bean names → startup failure. Fixed by explicit bean names (no class renames):
- friend `WebClientConfig` → bean `friendWebClientConfig`, its WebClient `@Bean("webTemplate")`
- group `WebClientConfig` → bean `groupWebClientConfig`, its WebClient `@Bean("webClient")`
- friend `WebConfig` → `friendWebConfig`; group `WebConfig` → `groupSecurityConfig`

The two `WebClient` beans are named to **match their consumer's field** (`FileWriteService.webTemplate`, `GroupFileService.webClient`) so Spring resolves them by name — no `@Qualifier` needed. `To add another WebClient: name the bean = the injecting field, or add @Qualifier.`

## Config
One file: `bootstrap/src/main/resources/application.yml`. The six former per-module `application.properties/.yml` were merged and **deleted** — a module jar must never ship its own `application.*` (they collide on the classpath, first-wins). Env var names are unchanged from the old services, so compose wiring carried over.

## Technology Notes (failure modes to audit)
- **Single JVM, single point of failure.** One OOM/crash takes down friend+group+connections+chrono+backup together. Acceptable by design (single-user, bespoke). Was ~1.2 GB across 4–5 JVMs; now **~300 MB** one JVM.
- **One persistence context, `ddl-auto: update`.** Every module's Hibernate mapping hits the same DB at boot. Safe today only because table names don't collide; a future entity named to clash with another module's table would silently map onto it. The startup WARN `constraint ... does not exist, skipping` is benign `update` chatter. `update` never drops columns — schema drifts additively.
- **`open-in-view` left at default (true).** friend/group Thymeleaf views lazy-load associations during render; setting it false (backup's old value) would throw `LazyInitializationException` in those views. Do not globalize `open-in-view: false`.
- **App-wide Spring Security = group's `groupSecurityConfig`.** One `SecurityFilterChain`: stateless, CSRF disabled, `permitAll`. It governs *every* module now, not just group. Any auth requirement must be added there, and it applies to all.
- **chrono calls friend over HTTP via nginx (`CHRONO_FRIEND_BASE_URL=http://nginx/api/friend`)** — now a loopback (app → nginx → same app). Works, but a needless round-trip; could be switched to a direct in-process call later.
- **nginx east-west coupling.** All five upstreams (`friend_service`, `group_service`, …) point at `communicator-app:8080`; names kept only so location blocks read unchanged. `connections`/`backup`/`chrono` bare-root paths return 404 by design (they only map deeper paths; connections' controller is a stub).
- **Build context.** Root `Dockerfile` builds the whole reactor; `.dockerignore` excludes react/python/`.git`/`target` so the JVM image doesn't ship them.

## Change Index
| Want to change… | Where |
|---|---|
| Add/remove a business module | root `pom.xml` `<modules>` + `bootstrap/pom.xml` dep + `CommunicatorApplication` scan lists |
| A module's public URL prefix | `PathPrefixConfig` **and** its `nginx.conf` location (must match) |
| Datasource / all app settings | `bootstrap/.../application.yml` (env-driven) |
| Scheduled job cadence | `chrono.schedule` / `backup.cron` in `application.yml` |
| App-wide security rules | `group/.../config/WebConfig.java` (bean `groupSecurityConfig`) |
| WebClient targets | `application.yml` `file.repository.service.url` (friend) / `resource.repository.url` (group) |
| The single service in compose | `docker-compose.yml` `communicator-app`; build via root `Dockerfile` |
