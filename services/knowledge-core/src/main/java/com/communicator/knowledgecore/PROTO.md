# knowledge-core — Proto

> **Proto, not a flow.** No flows of its own — this is a shared library extracted from friend/group/connections' "Knowledge"/"Permission" duplication (CODE_REUSE_REPORT.md §2). See each domain's own PROTO.md for how it's actually used.

Files: AbstractFact.java, AbstractFactService.java, KnowledgeChunkTriggerEvent.java, KnowledgeChunkTriggerListener.java, KnowledgeChunkTriggerClient.java, config/RabbitMqConfig.java

## Role

Two base classes extended by every domain module (friend/group/connections), **plus** (since 2026-08-20/21) three real `@Component`/`@Service`-scanned beans of its own — the eager knowledge-chunk trigger. Unlike `AbstractFact`/`AbstractFactService`, these ARE added to `CommunicatorApplication`'s scan lists (`com.communicator.knowledgecore`).

```
AbstractFact (@MappedSuperclass)
  id, date, text(@Lob,"fact"), priority("importance"), reviewDate, interval
  — field names UNCHANGED from the original hand-copied entities, so extending
    this does not change any existing table's columns (Hibernate's default
    naming maps the same field name to the same column whether it's declared
    directly or inherited from a mapped superclass).
  — deliberately does NOT include the owning relationship (friend/group/
    connection) — every domain's FK shape differs, so subclasses declare their
    own @ManyToOne.

AbstractFactService<T extends AbstractFact, ID>
  abstract repository() — subclass wires its own JpaRepository
  getById/findById/save/saveAll/deleteById — thin wrappers, but deleteById
    checks existsById first (no more catch-EmptyResultDataAccessException
    swallowing)
  update(id, changes) — FETCH-AND-MERGE, only text+priority. This is the one
    behavior decision baked into the base class: friend's original
    updateKnowledge/updatePermission did a blind whole-row save, which nulled
    reviewDate/interval whenever the client only sent {fact, importance} (the
    real frontend always does). group's version already merged correctly.
    Standardized on group's semantics for everyone.
  priorityPage(page, size) — the "priority DESC, page size N" pagination
    default that was hand-copied in every *KnowledgeService/*PermissionService.
```

## Eager knowledge-chunk trigger (2026-08-20 / RabbitMQ 2026-08-21)

The other reason this module exists as a shared dependency: it's where the Friend/Group/
Connection knowledge save paths converge on a single event → publish mechanism, instead of
each domain hand-rolling its own trigger.

```
Friend/Group/ConnectionKnowledgeService.save/saveAll/update()   (AbstractFactService override point)
 → ApplicationEventPublisher.publishEvent(KnowledgeChunkTriggerEvent)
 → KnowledgeChunkTriggerListener.onKnowledgeChunkTrigger()   @TransactionalEventListener(AFTER_COMMIT)
 → KnowledgeChunkTriggerClient.triggerChunk(event)
      RabbitTemplate.convertAndSend → durable queue knowledge.chunk.trigger (publisher confirms on)
      confirm nack / broker unreachable → HTTP fallback: POST {ai-agent.url}/knowledge/chunk
```

Full mechanics (queue naming, retry cap, DLQ, the ai_agent consumer) live in
[flows/knowledge-rag.md#eager-multi-entity-chunking](../../../../../../flows/knowledge-rag.md#eager-multi-entity-chunking)
and [ai_agent/PROTO.md](../../../../../../ai_agent/PROTO.md#internal-wiring--cross-entity-search-2026-08-20)
— this file only covers the JVM-side shape. `RabbitMqConfig` declares the durable queue +
DLQ beans (`knowledge.chunk.trigger[.dlq]`) so `RabbitAdmin` auto-declares them on connect
regardless of which side (this app or ai_agent's aio-pika consumer) comes up first.

Also republished, same event shape, by chrono's nightly `ChronoJobService.
reconcileMissingKnowledgeChunks()` for Group/Connection rows that ended up with zero
`knowledge_chunks` — see `chrono/PROTO.md`. That's the only other caller of
`KnowledgeChunkTriggerClient` outside the AFTER_COMMIT listener.

## What's deliberately NOT generalized

- **Owner-scoped finders** (`findByFriendId`, `findByGroupId`, `findByConnectionId`) stay in each domain's own repository. Spring Data derived query method names can't be meaningfully unified across a plain surrogate-id owner (friend/group) and a composite-embedded-id owner (connections) — forcing a fake shared abstraction here would cost more than the 3-line methods it "saves."
- **Social links** (`Social`/`GroupSocial`) and **media** (`Photos`/`Videos`/`PersonalResource` vs `GroupPhoto`/`GroupVideo`/`GroupResource`) are the same shape of duplication but weren't pulled in — out of scope for this pass, flagged as a possible follow-up if a 4th domain ever needs them.

## Change Index

| Thing to change | Where |
|---|---|
| Shared Knowledge/Permission fields | `AbstractFact` |
| Update semantics (currently merge-only text+priority) | `AbstractFactService.update()` |
| Default page size / sort | `AbstractFactService.priorityPage()` |
| Add a new module using this base | extend `AbstractFact` for the entity, `AbstractFactService<Entity, IdType>` for the service, implement `repository()` |
| Chunk-trigger publish (RabbitMQ + HTTP fallback) | `KnowledgeChunkTriggerClient.triggerChunk()` |
| Chunk-trigger queue/DLQ names | `RabbitMqConfig.KNOWLEDGE_CHUNK_TRIGGER_QUEUE`/`_DLQ` |
| Chunk-trigger fire site + AFTER_COMMIT timing | `KnowledgeChunkTriggerListener.onKnowledgeChunkTrigger()` |
| RabbitMQ connection (JVM side) | `bootstrap/src/main/resources/application.yml spring.rabbitmq.*` |
