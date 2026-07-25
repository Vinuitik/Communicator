# knowledge-core — Proto

> **Proto, not a flow.** No flows of its own — this is a shared library extracted from friend/group/connections' "Knowledge"/"Permission" duplication (CODE_REUSE_REPORT.md §2). See each domain's own PROTO.md for how it's actually used.

Files: AbstractFact.java, AbstractFactService.java

## Role

Two classes, both extended by other modules — this module has no controllers, no `@Service`/`@Entity`-scanned beans of its own, nothing added to `CommunicatorApplication`'s scan lists. It exists purely to be depended on.

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
