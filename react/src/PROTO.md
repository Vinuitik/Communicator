# React UI — Proto `[PARTIALLY REAL — 12 pages ported]`

> **Proto, not a flow.** Pages are being ported from the legacy MPA
> (`nginx/static/`) one at a time, preserving existing behavior/styling —
> the visual redesign is a deliberately separate later pass. See the "Two
> frontends" gotcha in [nginx/PROTO.md](../../nginx/PROTO.md).

Files: App.tsx, index.tsx, services/api/{config,friendService,groupService,connectionService,settingsService}.ts, hooks/useApi.ts, utils/{constants,friendMetrics}.ts, components/{atoms,molecules,organisms,templates,pages}/*

## Role

The modern SPA meant to replace the legacy MPA. React 18 + TypeScript + react-router-dom v6 + TailwindCSS, built with react-scripts (CRA). Built to static files and served by its **own** nginx (`react-ui:80`, config at `react/nginx.conf`), which the main nginx proxies at **`/app/`** (pure `proxy_pass`; the SPA-fallback `try_files` lives in `react/nginx.conf`, not the main nginx — see nginx/PROTO.md gotcha on why that split matters).

Structured with **atomic design**: `atoms` (Button, Input, Select, Textarea) → `molecules` (FormField, SearchBar, DropdownMenu, Pagination, FlashMessage) → `organisms` (Header, NavigationBar, KnowledgeEditor, AddFriendForm, FriendsTable, CreateGroupForm, GroupsTable, CalendarBoard, TalkedForm, KnowledgeCrudPanel) → `templates` (PageLayout) → `pages` (Home, Groups, AddFriend, CreateGroup, Calendar, Talked, GroupDetails, Facts).

## Internal wiring

```
index.tsx → App.tsx → <Router basename="/app"><PageLayout><Routes>
  /              → HomePage        [REAL — friends list]
  /calendar      → CalendarPage    [REAL — weekly calendar]
  /friends/add   → AddFriendPage   [REAL]
  /friends/:id/talked → TalkedPage [REAL — edit friend after talking]
  /friends/:id/knowledge → FactsPage [REAL — per-friend knowledge management]
  /groups        → GroupsPage      [REAL — group list]
  /groups/create → CreateGroupPage [REAL]
  /groups/:id    → GroupDetailsPage [REAL — single group, notes, settings]
  /settings      → SettingsPage     [REAL — AI mode/keys, Drive backup/restore]
  /analytics     → AnalyticsPage    [REAL — per-friend EMA-smoothed charts]
  /friends/:id/social → SocialPage  [REAL — per-friend social/contact links]
  /friends/:id/fileUpload → FileUploadPage [REAL — per-friend file upload]

PageLayout renders NavigationBar (real brand: "Friends Tracker", brand-purple,
real nav links). Every top-level nav item is now either a real internal
<Link> or an honest external <a> to a genuinely-unported legacy page
(Stats) — flip each link as its destination page is ported (see
AddFriendForm/CreateGroupForm Cancel buttons and AddFriendPage/
CreateGroupPage post-submit redirects, all now navigate(), for the pattern).
NavigationBar's "Home" deliberately does NOT match the legacy nav (there,
"Home" points at calendar.html, not "/") — see the comment in
NavigationBar.tsx for why that's kept as the SPA's own convention rather than
reproduced; Calendar got its own nav item instead.

services/api/config.ts        — single source of API base paths (mirrors nginx/static/shared/config.js)
services/api/friendService.ts — REAL: addFriend, getFriendsPage, getFriendsCount, getFriendsThisWeek, getFriend, talkedToFriend, removeFriend, getFriendKnowledge, addFriendKnowledgeItem, deleteFriendKnowledgeItem
services/api/groupService.ts  — REAL: createGroup, getGroups, deleteGroup, getGroup, getGroupKnowledge, addGroupKnowledge, deleteGroupKnowledge, getGroupPermissions, addGroupPermission, deleteGroupPermission
services/api/settingsService.ts — REAL: getLlmSettings, setLlmMode, saveProviderKey, removeProviderKey, checkHostWrapperStatus, getBackupStatus, disconnectDrive, setBackupEnabled, runBackup, restoreBackup
services/api/friendService.ts — also now REAL: getShortFriendList, getFriendAnalytics (AnalyticsPage), getFriendSocials/createFriendSocial/updateFriendSocial/deleteFriendSocial (SocialPage)
services/api/connectionService.ts — still stubs, untouched
utils/analyticsMath.ts         — ported 1:1 from analytics.js's EMA smoothing pipeline (see AnalyticsPage note)
utils/socialFormat.ts          — platform icons/validation/help-text ported from social's config.js + formValidator.js + urlHelper.js (see SocialPage note)
utils/friendMetrics.ts        — pure functions for the friends-list days-diff/intensity coloring (ported from mainPage/index.js)
hooks/useApi.ts               — generic fetch hook, unused so far — every real page manages its own fetch state instead
utils/constants.ts            — ROUTES, TIMEOUTS, DEFAULTS (API_BASE_URL removed — see config.ts; FRIENDS route removed — see HomePage note below; CREATE_GROUP repointed from the legacy nginx static-file path to the real SPA route)
```

## HomePage — what "ported" means here

`components/pages/HomePage` reimplements `nginx/static/mainPage/index.js`: paginated "All Friends" / non-paginated "This Week" toggle, colored days-until-due and intensity-score cells (`utils/friendMetrics.ts`), per-row actions dropdown (`molecules/DropdownMenu`, generic — not friends-specific), delete with `confirm()` + refresh. The scaffold had a separate `/friends` route (`FriendsPage`) that didn't correspond to anything in the legacy app — "All Friends" and "This Week" are the *same* legacy page, toggled client-side, not two pages — so that route was deleted rather than left as a second, competing implementation.

`Talked`/`Profile`/`Knowledge`/`Groups`/`Connections` per-row links still point at the legacy MPA (`services/api/config.ts` `API_BASE` prefixes) — none of those destination pages are ported yet.

## AddFriendPage — what "ported" means here

`components/pages/AddFriendPage` composes `AddFriendForm` (name/lastSpoken/experience/hours/dob — the 5 legacy fields) and `KnowledgeEditor` (fact/importance list). On submit it builds the exact payload shape `FriendController.addFriend` expects (`types/api.ts` `NewFriendPayload`, mirrored from the Java `Friend`/`FriendKnowledge` entities) and POSTs for real. `KnowledgeEditor` has **no API calls of its own** — matches the legacy behavior on this specific page (knowledgeManager.js only writes to the DOM table here; there's no friend id yet to attach knowledge to). It becomes API-backed when facts.html's equivalent gets ported.

## CreateGroupPage — what "ported" means here

`components/pages/CreateGroupPage` composes `CreateGroupForm` (name field, real-time validation mirroring the backend's own rules — 2-100 chars, no `<>"'&`) and the new `FlashMessage` molecule (auto-dismiss success/error banner — this exact pattern is hand-rolled independently in both `createGroup.js` and `settings.js` in the legacy code, worth reusing rather than re-deriving again when settings gets ported). Submits to the real `POST /api/groups/create` and models its actual response shape (`{success, message, group}` on **both** success and failure, not a bare `Group` — see `types/api.ts` `CreateGroupResponse`). Verified against the live API during the port (created and deleted a real group through nginx, not just curl against the container directly).

The legacy page's buttons were `#007bff` (Bootstrap blue) — every other legacy page uses the brand purple. Ported to `brand`, not copied — this migration is explicitly meant to *stop* carrying forward that kind of mismatch, not preserve it page-for-page.

## GroupsPage — what "ported" means here

`components/pages/GroupsPage` reimplements `allGroups.html` + `groupsView.js`: fetches the group list, `GroupsTable` organism renders name/contacts(placeholder, unimplemented in legacy too — always "0 Coming Soon")/knowledge-count/permission-count/actions-dropdown, row click navigates to group details, delete with confirm + refresh + `FlashMessage`.

**This page didn't have a JSON API to call.** The only existing "list groups" endpoint was `GroupWebController`'s `GET /`, which renders the Thymeleaf view — no REST equivalent existed. Added `GET /api/groups/list` to `GroupApiController` (backend commit, not just frontend) reusing the exact same service calls the Thymeleaf controller already makes, at a distinct path so it doesn't collide with the existing HTML route. **This is a real pattern worth expecting again**: legacy Thymeleaf-rendered pages (anything under `group/.../templates/`) may not have a JSON counterpart at all — check for one before assuming the port is frontend-only. `Knowledge`/`Social` dropdown links still point at the legacy MPA; `Social`'s target (`/group/social/{id}`) was already a dead link in the legacy template (no matching nginx route) — copied as-is, not a regression from this port. Row-click and `Profile` now navigate internally to `GroupDetailsPage` (`groupDetailsPath()`) — see that page's note for why they didn't originally.

## CalendarPage — what "ported" means here

`components/pages/CalendarPage` + `organisms/CalendarBoard` reimplement
`calendarView/calendar.html` + `calendar.js`: fetches `GET /api/friend/thisWeek`
(same endpoint HomePage's "This Week" tab already uses — its response shape,
including `isBirthdayThisWeek`, was added to `types/api.ts` `Friend` for this
port) and buckets friends into a Mon-Sun grid plus a "Previous" (overdue)
column, entirely client-side, matching the legacy date math exactly (including
its loop-index-to-`Date#getDay()` conversion). Friend-box category coloring
(birthday > family > work > personal, by keyword match on `experience`) and
the birthday pulse animation (`tailwind.config.js` `birthday-pulse` keyframe)
are ported 1:1. Clicking a friend box now navigates internally to TalkedPage
(`utils/constants.ts` `talkedPath(id)`, same pattern FriendsTable's "Talked"
item uses). "+ Add Friend" uses internal `navigate()` since AddFriendPage is
real; "+ Add Context" still just alerts "not implemented yet", matching
legacy — that's a real unimplemented feature there too, not a stub introduced
by this port.

## TalkedPage — what "ported" means here

`components/pages/TalkedPage` + `organisms/TalkedForm` reimplement
`friend/.../templates/talkedForm.html` + `updateForm/talkedForm.js` — the
"log that you talked to this friend" edit form, reached at
`/friends/:id/talked` (react-router's first internal per-entity route; see
`ROUTES.TALKED` + `talkedPath()` in `utils/constants.ts`).

**This page didn't have a JSON API to read from either.** The legacy version
was server-rendered — Thymeleaf bound the `Friend` into the template
(`WebController.showFriendForm`). Added `GET /api/friend/{id}`
(`FriendController.getFriend`) returning the same `FriendDTO` `allFriends`/
`thisWeek` already use. Watch for this: `FriendService.findById` returns a
**blank `new Friend()` (id == null), not null**, when nothing matches — a
pre-existing quirk of that method, not something this port introduced; the
new endpoint checks `friend.getId() == null` to turn that into a real 404,
verified with both a real id and `/api/friend/999`.

`TalkedForm` is `AddFriendForm`'s twin (same `FormField`/`Button` composition)
minus "Last Time Spoken" — the legacy JS always sends *today's* date for this
form, not a user-editable one — and pre-populated from the fetched friend
instead of starting blank. Submits `PUT /api/friend/talkedToFriend/{id}`
(`friendService.talkedToFriend`, already existed server-side, just never had
a JSON caller before this port).

The knowledge section reuses `KnowledgeEditor` completely unchanged (local-only,
no API calls) — not a shortcut, that's what the legacy page actually does
here too: the shared `KnowledgeManager` class it instantiates derives its
entity id by looking for a `"knowledge"` path segment in the URL, which
`/talked/{id}` never has, so its "load existing knowledge" / pagination /
committed-table logic is dead code on this specific legacy page. The only
part that actually runs is the plain `collectKnowledgeData()` export reading
a local staging table — exactly what `KnowledgeEditor` already does. (The
*real* API-backed knowledge editing in `KnowledgeManager` will matter once
`facts.html` itself is ported — that's a separate, still-unported page.)

Verified against the live API through real nginx during the port: created a
throwaway friend, fetched it via the new endpoint, updated it via
`talkedToFriend`, confirmed the changes round-tripped, then deleted it.

## GroupDetailsPage — what "ported" means here — read this before touching groupDetails again

`components/pages/GroupDetailsPage` is nominally ported from
`group/.../templates/groups/groupDetails.html`, but that template was
**dead code**: no controller (`GroupWebController` only has `GET /`,
`GET /create`, `GET /{id}/knowledge`) ever rendered it, and it referenced
`${group.knowledge}` — a property `SocialGroup` doesn't have (only
`permissions` and `socials`). Its own JS also called `deleteGroup()`,
`addPermission()`, `editPermission()`, `deletePermission()` — none defined
anywhere. Escalated to the user rather than silently deciding; the call was
**build it for real**, i.e. this page is new feature work using
already-existing, already-working backend endpoints that just never had a UI:

- `GroupApiController.getGroupDetails` (`GET /api/groups/{id}`) and
  `.deleteGroup` (`DELETE /api/groups/{id}`) — `deleteGroup` was already
  exercised by `GroupsTable`; this page's "Delete Group" button reuses the
  exact same `groupService.deleteGroup` call the legacy button's undefined
  `deleteGroup()` onclick never could.
- `GroupApiController`'s knowledge endpoints (`addKnowledge`/`getKnowledge`/
  `deleteKnowledge`) — the "Notes" section. `updateKnowledge` exists too but
  isn't wired: the legacy `editKnowledge()` was already a no-op stub, and no
  other ported page has row-level edit yet either, so Add + List + Delete is
  the consistent scope, not a gap.
- `GroupPermissionController` (mounted at `/api/groups/permission/...`,
  package-prefixed like everything else in `com.example.demo` — see
  `PathPrefixConfig`) — the "Settings" section. Same shape as
  `GroupKnowledge` (`GroupPermission.java` is fact/importance under the hood
  too, `@JsonProperty`-renamed from `text`/`priority`) despite the legacy
  template's `permissionType`/`description` field names, which don't exist
  on the entity — presented honestly as Setting/Priority instead of
  reproducing names that were never real.

**No backend changes were needed** — everything above already existed and
worked, it just had no route/link pointing at it. `KnowledgeCrudPanel` (new
organism) drives both the Notes and Settings sections — same
add-form/list/delete pattern, parameterized by API calls and labels, the way
the legacy `KnowledgeManager` class configured itself per entity type. It's
the generic, API-backed sibling to `KnowledgeEditor` (which stays
local-only, for pages with no entity id yet) — expect to reuse it again for
`facts.html` and `groupKnowledge.html` when those get ported, since both are
the exact same shape.

"Contacts" stays a static "Coming Soon" placeholder, copied as-is — there's
no contacts feature anywhere in the backend to port.

Verified against the live API through real nginx during the port: created a
throwaway group, fetched it via the new page's calls, added and deleted both
a note and a setting, confirmed each round-tripped, then deleted the group.

## FactsPage — what "ported" means here

`components/pages/FactsPage` reimplements `friend/.../templates/facts.html`
(reachable at `WebController.knowledge`, `GET /api/friend/knowledge/{id}` —
genuinely live, unlike groupDetails). Reuses `KnowledgeCrudPanel` a second
time, proving out the abstraction: `FriendKnowledge.java` serializes to the
identical `{id, fact, importance}` shape `GroupKnowledge`/`GroupPermission`
do, so nothing new was needed there. Backend: no new endpoint either —
`FriendKnowledgeController.getKnowledgePaginatedCustomSize` (`GET
/api/friend/getKnowledge/{friendId}/page/{page}/size/{size}`) already
existed for the MCP/AI server and happens to return exactly this shape;
called with `size=1000` instead of adding a bespoke "get all" endpoint.

Same two simplifications as `GroupDetailsPage`, applied consistently: no
stage-then-batch-submit (legacy's "add to a temp table, then click Submit
Info" two-step — each Add here is an immediate real API call) and no
pagination (per-friend fact counts are small in this single-tenant app).
`FriendsTable`'s "Knowledge" dropdown item now navigates internally
(`friendKnowledgePath()`) instead of linking to the legacy MPA.

**`groupKnowledge.html` (the group-side equivalent, at `GET
/{id}/knowledge`) was deliberately *not* ported as its own page** — it would
have been near-total UI duplication of `GroupDetailsPage`'s existing "Notes"
`KnowledgeCrudPanel`, which already covers add/list/delete for group
knowledge on the group details page itself. `groupKnowledge.html` is real
(unlike `groupDetails.html` was), just redundant now that its functionality
lives on the details page — if per-page real estate or a dedicated
management view is wanted later, revisit, but building a second copy of the
same CRUD list wasn't worth it.

Verified against the live API through real nginx during the port: created a
throwaway friend, added and deleted a knowledge item via the new page's
calls, confirmed it round-tripped, then deleted the friend.

## SettingsPage — what "ported" means here

`components/pages/SettingsPage` reimplements `nginx/static/settings/settings.html`
+ `settings.js` — the odd-one-out page in this migration: it's a control
panel over **two separate backend services**, not the Friend/Group entity
CRUD every prior page has been. No new backend code was needed for either
half — same pattern as GroupDetailsPage/FactsPage, this page's whole job was
adding a UI over already-working services:

- **AI mode + cloud provider keys** — `ai_agent`'s `routers/settings.py`
  (`GET/PUT /api/ai/settings/llm`, `PUT/DELETE .../providers/{provider}`,
  `GET .../host-wrapper-status`). This is the same service [[communicator-llm-settings]]
  built the UI-switchable local/cloud toggle for originally — this port just
  moves that existing legacy-JS UI into the SPA verbatim, no new capability.
- **Google Drive backup/restore** — the `backup` Java package, folded into
  the `communicator-app` JVM monolith (`BackupController`, mounted at
  `/backup/**`) — not a separate container despite `backup/` looking like
  its own service on disk; see [[communicator-jvm-monolith]].

`services/api/settingsService.ts` talks to both under one file since the
legacy page did too — `LLM_API` (`/api/ai/settings/llm`) and `BACKUP_API`
(`/backup`) are two different `API_BASE` prefixes, not a typo.

No shared organism reuse here — the mode-radio cards, provider-key rows, and
backup status cards are all one-off layouts specific to this page (unlike
`KnowledgeCrudPanel`'s three call sites elsewhere), so they're inline in
`SettingsPage.tsx` behind a small local `Card` wrapper rather than factored
into new atoms/molecules that would only ever have one caller.

Verified against the live API through real nginx: `curl`'d all three
real endpoints directly (`/api/ai/settings/llm`, `.../host-wrapper-status`,
`/backup/status`) and confirmed the JSON shapes match `types/api.ts` exactly
before wiring the component to them. **Not click-tested in a real browser**
— same gap as CalendarPage: the sandbox's `browse`/gstack tooling needs a
one-time `bun` install this environment doesn't have. Confirmed instead that
`GET /app/settings` 200s through nginx's SPA fallback and that the CRA
production build compiles clean (`docker compose build react-ui`).

## AnalyticsPage — what "ported" means here

`components/pages/AnalyticsPage` reimplements `nginx/static/analytics/analytics.html`
+ `analytics.js` — reached via the legacy **"Stats" nav link**, which was
never actually broken like `Social`'s was: `nginx.conf`'s `location = /stats`
serves `analytics.html` directly (`try_files /analytics/analytics.html`).
`NavigationBar`'s "Stats" `<a>` now points at the internal `/analytics`
route instead. No other legacy page links here — this and `groupDetails`/`facts`
are the only ported pages reached solely through nav, not a per-row link.

No `:id` in the route — friend selection is a client-side `<select>`
(`FriendController.getShortList`, `/api/friend/shortList`, already existed
and returns exactly the `{id, name, averageFrequency, averageDuration,
averageExcitement}` shape needed) and the date range is two plain date
inputs, matching the legacy page's own UX exactly (not entity-scoped like
Talked/Facts).

`FriendAnalyticsController.getAnalyticsList` (`/api/friend/analyticsList?friendId&left&right`)
also already existed — **third page in a row that turned out not to need a
new backend endpoint**, breaking the pattern SettingsPage started (that one
also had a full API already). Both `left`/`right` bind straight to
`LocalDate` query params server-side.

The EMA smoothing (`utils/analyticsMath.ts` `computeAnalyticsSeries`) is
ported byte-for-byte from `updateCharts()`'s per-day-bucket + asymmetric
decay-alpha logic — the alpha constants (`0.6/0.7/0.8` new-data,
`0.07/0.2/0.57` decay) aren't derived from anything documented in the legacy
code, so they're preserved exactly rather than re-tuned or explained.

**New dependency: `chart.js`** (added to `package.json`, no `react-chartjs-2`
wrapper — a local `LineChart` component in `AnalyticsPage.tsx` drives the
`<canvas>` via a ref + `useEffect`, matching the legacy page's own
imperative Chart.js usage instead of adopting a new abstraction layer for a
single call site). The legacy page loaded Chart.js from an external CDN
(`cdn.jsdelivr.net`) — the SPA bundles it via npm instead, so the built app
has no runtime dependency on that CDN being reachable.

"Add Data" is wired to an alert, same honest-stub treatment as
`CalendarBoard`'s "+ Add Context" — the legacy button had **no click handler
at all** (checked `analytics.js` for an `add-data-btn` listener; there isn't
one), so this is arguably more informative than what it replaces, not a
regression.

Verified against the live API through real nginx: created a throwaway
friend with an analytics entry via `addFriend`, confirmed it appears in
`shortList` and that `analyticsList` returns the exact entry with the id
Jackson assigned, then deleted the friend. Not click-tested in a real
browser — same `bun`-install gap as CalendarPage/SettingsPage.

## SocialPage — what "ported" means here — read this for the URL/url gotcha before touching Social again

`components/pages/SocialPage` reimplements `nginx/static/social/social.html`
+ its `modules/` directory (`config.js`, `formValidator.js`, `urlHelper.js`,
`socialApiService.js`, `socialListRenderer.js`, `socialMediaManager.js`,
`modalManager.js`) — CRUD for one friend's social/contact links. Only
reachable in the legacy app from `profile.js`'s `socialLinks` module
(`window.location.href = '/social?friendId=' + id`) — not linked from
anywhere else there, and **not linked from anywhere in the SPA yet either**,
since ProfilePage isn't ported. `friendSocialPath(id)` exists and the route
works if hit directly; it becomes reachable through the UI once ProfilePage's
social-links section is ported and links here — same "built ahead of its
entry point" situation, worth remembering rather than assuming a page with
no incoming link is dead (unlike `groupDetails.html`, this one is real).

Repointed from the legacy's `?friendId=` query param to a `:id` path segment
(`friendSocialPath`), matching every other per-entity route in this SPA.

`SocialController`'s full CRUD (`GET/POST /api/friend/socials/{friendId}`,
`PUT .../socials/update/{socialId}`, `DELETE .../socials/delete/{socialId}`)
already existed — no backend changes needed.

**Real bug found and deliberately NOT fixed — the `URL`/`url` casing trap:**
`Social.java`/`SocialDTO.java` name the field `URL` (capital), and the legacy
JS's `socialMediaManager.js` builds its POST/PUT body as `{...formData, URL:
URLHelper.formatURL(...)}` — spreading the raw lowercase `url` from the form
*and* adding a capital-`URL` key holding the platform-formatted value
(auto `mailto:` prefix for Email, auto `https://` prefix otherwise).
Verified live against the real backend: Jackson actually (de)serializes this
field as **lowercase `url`**, on both request and response — a POST with
`"URL"` 400s (`SocialService.validateSocialDTO` sees a null url and rejects
it as empty). So the raw `formData.url` in the spread is what's actually
saved; the capital-`URL` key — and the entire formatting step — has been
silently dead in production this whole time. `socialListRenderer.js`'s own
`social.URL || social.url || 'No URL'` fallback is a tell that whoever wrote
it had already run into this inconsistency.

This port sends the raw, unformatted value under `url` (the key the backend
actually reads) rather than "fixing" it to apply the intended formatting —
see `utils/socialFormat.ts`'s comment for why: the backend's own
`isValidUrl` already accepts bare emails, bare phone numbers, and
`@username`-style handles directly, and prefixing `https://` in front of an
`@username` would break every one of those existing acceptance patterns.
Matching years of real (if accidental) production behavior was judged safer
than applying untested original intent.

Edit is inline-in-row (toggle a row into an edit form in place) rather than
the legacy's modal overlay, and delete uses `window.confirm` rather than the
legacy's custom confirm modal — both match the "behavior preserved,
presentation simplified" precedent already set (`CreateGroupPage`'s button
color, every other delete flow in this SPA). Both Edit and Delete are real
here (unlike `KnowledgeCrudPanel`'s Add+Delete-only scope) because the
legacy page's edit flow was fully wired and working, not a stub.

Verified against the live API through real nginx: created a throwaway
friend, created a social link, confirmed it listed, updated it, deleted it,
confirmed it was gone, then deleted the friend — exercising the full CRUD
surface this page drives.

## FileUploadPage — what "ported" means here

`components/pages/FileUploadPage` reimplements `nginx/static/fileUpload/{fileUpload.html,fileUpload.js}` + its 9-file `JS_Classes/` directory (`FileValidator`, `FileCollection`, `DragDropHandler`, `FileListRenderer`, `FileUtilities`, `PreviewManager`, `ProgressTracker`, `UIStateManager`, `UploadController`) — collapsed into one component's `useState`/`useEffect`, since React's re-render model replaces the manual DOM-listener/render wiring those classes existed for. Drag & drop, per-file validation (max 10 files, 50MB cap, duplicate-name+size check), a click-to-preview file list (image/video/audio/pdf/default, via `URL.createObjectURL` + revoke-on-close), and the upload/clear actions are all ported 1:1.

Reached at `/friends/:id/fileUpload` (`fileUploadPath`) — legacy parsed `friendId` off the URL's last path segment (`/fileUpload/{friendId}`, `UploadController.js`) since it had no router; repointed to a real `:id` param, same as every other per-entity route in this SPA. **Not linked from anywhere in the SPA yet** — the only legacy entry point (`profile.js`/`modules/mediaUpload.js`, `window.location.href = '/fileUpload/' + friendId`) lives on `ProfilePage`, which isn't ported — same "built ahead of its entry point" situation `SocialPage` was in before it.

`FileController.uploadFiles` (`POST /api/friend/files/upload`, mounted under the `/api/friend` prefix — see `PathPrefixConfig`) already existed and matches the legacy multipart body exactly (`files` repeated field + `friendId`) — no backend changes needed. Added `uploadFriendFiles` to `friendService.ts`.

The progress bar is ported as **decorative**, matching real legacy behavior found while reading `UploadController.js`: `progressTracker.update()` is only ever called with `0` — before showing the bar and again in the `finally` block — nothing in the original code ever computed a real byte-level percentage. Preserved rather than "fixed" into a real progress indicator, consistent with this port's behavior-preserving mandate.

No Font Awesome — the legacy page loaded it from a CDN (`cdnjs.cloudflare.com`) purely for file-type icons; replaced with emoji (🖼️🎬🎵📕📄), the same no-new-CDN-dependency call `AnalyticsPage` made for Chart.js, and the same icon convention `SocialPage` already established (📱✏️🗑️) rather than adding a font icon library for one page.

Verified against the live API through real nginx during the port: `curl -F "files=@..." -F "friendId=..."` directly against `/api/friend/files/upload` and confirmed `{"message":"Files uploaded successfully"}`, using a throwaway friend (created and deleted after). **Not click-tested in a real browser** — same `bun`-install gap noted for CalendarPage/SettingsPage/AnalyticsPage; confirmed instead that the CRA production build compiles clean (`docker compose build react-ui`).

## Seams (intended vs actual)

**Outbound:** browser → main nginx `/api/friend/...` or `/api/groups/...` → `communicator-app:8080`. Relative `/api/...` is correct since the SPA is always reached through `/app/` on the same nginx origin — see `services/api/config.ts`.

**Real today:** everything in `friendService.ts`, `groupService.ts`, and `settingsService.ts`. `connectionService` is still a placeholder that returns empty arrays / logs to console — calling it does nothing real.

## Gotchas / Technology Notes

- **Styles are being ported as Tailwind utility classes, not the legacy CSS files verbatim.** `tailwind.config.js` carries the legacy brand tokens (`brand` = `#6A5ACD`, `surface` = `#f5f5f5`, `font-sans` = Roboto) so ported components look the same without copying 100+ line CSS files in wholesale. If a ported page visibly drifts from the legacy page's look, check the Tailwind classes against the source CSS file in `nginx/static/`, not the other way around.
- **`react-ui` is a baked Docker image**, same trap as the main nginx: editing anything under `react/` (including `react/nginx.conf`) does nothing to the running container until `docker compose build react-ui && docker compose up -d react-ui`.
- **`Router` needs `basename="/app"`.** The browser URL is always `/app/...` (that's what nginx's `location /app/` matches on), but proxy_pass strips the prefix before react-ui ever sees the request — react-ui's own server only ever sees `/`, `/friends/add`, etc. `basename` reconciles this: without it, every route silently fails to match once actually deployed through nginx (this bit the very first page ported — see nginx/PROTO.md's `/app/` gotcha for the matching backend-side bug).
- **CRA detects the `/app/` mount from `package.json`'s `homepage` field** and prefixes built asset URLs accordingly (`/app/static/js/main.*.js`). Don't remove that field.
- **No state manager / data-fetching lib** (no Redux/Zustand/React Query) — `useApi` exists but neither real page uses it; each manages its own `useState`/`useEffect` fetch instead. Revisit once pages need to share server state (e.g. a friend count badge in the nav).
- **`window.confirm`/`window.alert` used for delete confirmation and error reporting** (HomePage, GroupsPage), matching the legacy page's UX exactly. Not blocked from being replaced with a nicer in-app modal — just not done yet, to keep this port behavior-preserving.
- **Not every legacy page has a JSON API to port to — but don't assume it's missing either.** Thymeleaf-rendered pages (`group/.../templates/`, `friend/.../templates/`) sometimes only expose the server-rendered HTML route (GroupsPage needed `GET /api/groups/list`, TalkedPage needed `GET /api/friend/{id}`). But **SettingsPage and AnalyticsPage both needed zero backend changes** — every endpoint they call already existed and matched the legacy JS's calls exactly. Check the relevant `*Controller.java` for a `@RestController`/JSON-returning sibling every time rather than assuming either outcome.
- **A page can span more than one backend service.** SettingsPage is the first page to call two unrelated services (`ai_agent` for LLM settings, the JVM monolith's `backup` package for Drive backup) from one component — `services/api/settingsService.ts` mirrors that by importing both `API_BASE.AI` and `API_BASE.BACKUP` rather than picking one, unlike every prior `*Service.ts` file which only ever touched one prefix.
- **`FriendService.findById` returns a blank `new Friend()` (id == null) for a missing id, not null.** Bit `FriendController.getFriend`'s first draft (returned 200 with an all-null body instead of 404) — check `.getId() == null`, not `== null`, when using this method to decide "found vs not."

## Change Index

| Thing to change | Where |
|---|---|
| Add/change a backend API prefix | `services/api/config.ts` `API_BASE` |
| Wire a real API call for a stubbed page | `services/api/*.ts` (replace placeholder body) |
| Add a route | `App.tsx` `<Routes>` + `utils/constants.ts` `ROUTES` |
| Port the next legacy page | new `components/pages/<Name>Page/`, reuse existing atoms/molecules/organisms first — check `components/{atoms,molecules,organisms}/index.ts` before writing a new one |
| Friends-list coloring thresholds | `utils/friendMetrics.ts` |
| Group-name validation rules | `components/organisms/CreateGroupForm/CreateGroupForm.tsx` (keep in sync with `SocialGroup` backend validation if that ever gains `@Valid` constraints) |
| Group list JSON shape | `GroupApiController.listGroups` (`GET /api/groups/list`) + `types/api.ts` `GroupListResponse` |
| Calendar week bucketing / friend-box coloring | `components/organisms/CalendarBoard/CalendarBoard.tsx` |
| Single-friend fetch / talked-to update | `FriendController.getFriend` (`GET /api/friend/{id}`) + `.updateFriend` (`PUT /api/friend/talkedToFriend/{id}`), `services/api/friendService.ts` |
| Group notes / settings CRUD | `GroupApiController` knowledge endpoints + `GroupPermissionController`, `services/api/groupService.ts`, `components/organisms/KnowledgeCrudPanel` |
| Per-friend knowledge CRUD | `FriendKnowledgeController`, `services/api/friendService.ts` (`getFriendKnowledge`/`addFriendKnowledgeItem`/`deleteFriendKnowledgeItem`), `components/pages/FactsPage` |
| AI mode / cloud provider keys | `ai_agent/routers/settings.py`, `services/api/settingsService.ts` (`getLlmSettings`/`setLlmMode`/`saveProviderKey`/`removeProviderKey`/`checkHostWrapperStatus`), `components/pages/SettingsPage` |
| Google Drive backup/restore | `backup/.../BackupController.java` (mounted in `communicator-app`), `services/api/settingsService.ts` (`getBackupStatus`/`disconnectDrive`/`setBackupEnabled`/`runBackup`/`restoreBackup`), `components/pages/SettingsPage` |
| Per-friend analytics charts / EMA smoothing | `FriendAnalyticsController` (`GET /api/friend/analyticsList`), `FriendController.getShortList`, `utils/analyticsMath.ts`, `components/pages/AnalyticsPage` |
| Per-friend social/contact links CRUD | `SocialController` (`/api/friend/socials/**` — note lowercase `url` wire key despite the Java field name), `services/api/friendService.ts` social functions, `utils/socialFormat.ts`, `components/pages/SocialPage` |
| Per-friend file upload | `FileController.uploadFiles` (`POST /api/friend/files/upload`), `services/api/friendService.ts` (`uploadFriendFiles`), `components/pages/FileUploadPage` |
| Brand tokens (color/font) | `tailwind.config.js` `theme.extend` |
| Nav links / branding | `components/organisms/NavigationBar/NavigationBar.tsx` |
| SPA mount path (ingress) | `nginx/nginx.conf` `location /app/` (main nginx) |
| SPA client-route fallback | `react/nginx.conf` (react-ui's own nginx) |
| Build/serve | `react/Dockerfile` (CRA build → nginx:alpine), rebuild `react-ui` image to deploy |
