# communicate — Domain Index

Navigation only. See each domain's FLOWS.md for actual flows.

## Domains

- [Chrono/FLOWS.md](Chrono/FLOWS.md) — Scheduled nightly decay, EMA updates, meeting generation, manual trigger
- [Friend/FLOWS.md](Friend/FLOWS.md) — Friend CRUD, knowledge, permissions, analytics, events, meetings, media, social, group membership, MCP/AI endpoints
- [Group/FLOWS.md](Group/FLOWS.md) — Group CRUD, knowledge, permissions, files, social links
- [Connections/FLOWS.md](Connections/FLOWS.md) — Connection entity model only; all service flows `[NOT IMPLEMENTED]`

## Cross-domain coupling

- `ChronoJobService` → `MeetingGenerationService`, `EmaUpdateService` (Friend domain)
- `FriendController` / `FriendAnalyticsController` expose HTTP endpoints that Chrono formerly called (may be legacy — Chrono now injects repos directly)
- `GroupMemberService` reads `Friend` entities to resolve group members
- `ConnectionPermissionService` shares permission concepts with `FriendPermissionService` but schema diverges (missing `priority`/`interval`/`reviewDate`)
