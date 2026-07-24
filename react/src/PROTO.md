# React UI — Proto `[REAL — dark-purple redesign complete, 7/7 stages]`

> **Proto, not a flow.** This SPA went through two real rewrites: first a
> straight MPA→SPA port (13 legacy Thymeleaf/static pages ported 1:1, see git
> history pre-2026-07 for that narrative — largely superseded now), then a
> full visual + IA redesign against a Claude Design handoff
> (`design_handoff_friends_tracker/`, unpacked from `CRM system redesign and
> branding.zip`) that consolidated 5 per-friend pages into one Profile hub,
> renamed Analytics→Insights, and reskinned everything to a dark-purple
> design system. This doc describes the **post-redesign** structure. The
> legacy MPA itself was deleted 2026-07-24 (`nginx/static/`, Thymeleaf
> templates, view-controllers) — recoverable from git history.

Files: App.tsx, index.tsx, services/api/{config,friendService,groupService,connectionService,settingsService}.ts, utils/{constants,friendMetrics,analyticsMath,avatar}.ts, tailwind.config.js, src/styles/globals.css, components/{atoms,molecules,organisms,templates,pages}/*

## Role

The only frontend. React 18 + TypeScript + react-router-dom v6 + TailwindCSS, built with CRA. Built to static files, served by its own nginx (`react-ui:80`, config at `react/nginx.conf`), reverse-proxied by the main nginx at **`/app/`**. Main nginx's root `/` redirects here.

## Route map (arrow chain)

```
index.tsx → App.tsx → <Router basename="/app"><ToastProvider><PageLayout><Routes>
  /                    → HomePage        (Week board — home)
  /friends             → FriendsPage     (All/Overdue/This-week table)
  /friends/add         → AddFriendPage
  /friends/:id/profile → ProfilePage     (hub: hero + Overview/Media/Socials/Trends tabs + floating AI chat)
  /groups              → GroupsPage      (3-col cards)
  /groups/create       → CreateGroupPage
  /groups/:id          → GroupDetailsPage (People/Notes/Settings)
  /insights            → InsightsPage    (KPIs, compare chart, needs-attention, AI placeholder)
  /settings            → SettingsPage
```

Old routes still registered as redirects (bookmarks land somewhere real, nothing links to them anymore): `/calendar`→`/`, `/analytics`→`/insights`, `/friends/:id/talked|knowledge|social`→Profile, `/friends/:id/fileUpload`→Profile (`RedirectToProfile` in App.tsx). To retire a redirect entirely: delete its `<Route>` in App.tsx + the matching `ROUTES.*` key in `utils/constants.ts`.

## Design system (Stage 1 foundation)

Files: tailwind.config.js, src/styles/globals.css, components/atoms/{Avatar,Logo,ProgressBar}, components/molecules/{Tabs,SegmentedControl,RatingPicker,ConfirmDialog,Toast}

Dark-purple tokens (`bg`/`surface`/`surface-2`/`input`/`input-2`/`modal`/`hairline`, semantic `good`/`soon`/`bad`, `category`/`social` colors) live in `tailwind.config.js`'s `theme.extend.colors`. **Accent is a CSS custom property, not a flat hex** — `--accent`/`--accent-light`/`--accent-lighter`/`--accent-grad-from`/`-to` in `src/styles/globals.css`. To re-theme (e.g. switch to the sanctioned blue `#6366F1`): edit those 5 variables in one place, nothing else. Fonts: Space Grotesk (`font-display`, headings/big numbers) + Hanken Grotesk (`font-sans`, body), loaded via `public/index.html` Google Fonts `<link>`s.

Shared primitives: `Tabs` (Profile hub's tab row), `SegmentedControl` (Structured/Raw toggle, Insights metric/range pills — same active-color for every option), `RatingPicker` (Great/Okay/Bad chips — each option needs its **own** color, so it's a separate component from SegmentedControl; used by `QuickLogModal` and `AddFriendForm`, options array is `EXPERIENCE_RATINGS`), `ConfirmDialog` (replaces `window.confirm`), `Toast` (`useToast()`, replaces `window.alert`/ad-hoc flash messages — `showToast(message, variant?)`, variant is `'success'` (default, green ✓) or `'error'` (red ✕), added Stage 7 when Settings/GroupDetailsPage's failure paths needed something other than a green checkmark).

`ConfirmDialog`/`Toast` are the **only** sanctioned pattern for confirm/error UI as of Stage 7 — every `window.confirm`/`window.alert` call site in the app was swept and converted (GroupDetailsPage's delete-group confirm, SettingsPage's disconnect/restore confirms and 4 error alerts).

## Profile hub (Stage 3) — the consolidation point, read this before touching Profile

Files: pages/ProfilePage.tsx, organisms/{TalkedForm,MediaGallery,SocialsPanel,TrendsPanel,KnowledgeSummaryTable,KnowledgeCrudPanel,AiChatWidget,QuickLogModal}

```
ProfilePage → hero (Avatar/name/Last-met/Next/Intensity/Birthday stat row)
            → "Log chat" → QuickLogModal (talkedToFriend, minimal payload, closes+toasts, no navigation)
            → "Edit details" → TalkedForm in a modal (repurposed from its old standalone-page role)
            → Tabs: Overview | Media | Socials | Trends
            → AiChatWidget (floating ✦ button, fixed bottom-right)

Overview tab (2-col):
  left  → Knowledge (SegmentedControl Structured/Raw: Structured=KnowledgeSummaryTable (AI-summarized),
          Raw=KnowledgeCrudPanel compact mode over getFriendKnowledge)
        → People & relationships [PLANNED — no backend entity exists]
        → Recent interactions (real — getFriendAnalytics, last 5 shown)
  right → Groups (real — getFriendGroupIds + getGroups, pill list)
        → Upcoming [PLANNED — always renders ≥1 designed "suggested" card]
        → Topics to discuss [PLANNED]

Media tab   → MediaGallery (upload/primary-photo/delete/pagination, unchanged logic, reskinned)
Socials tab → SocialsPanel (CRUD, inline list rows)
Trends tab  → TrendsPanel (per-friend EMA sparklines via analyticsMath.computeAnalyticsSeries,
              range pills from ANALYTICS_RANGES, "Global insights →" navigates to /insights)
```

To change what counts as "High"/"Medium" for Group Settings tags: `KnowledgeCrudPanel`'s `importanceFormat` prop (only Group Settings passes one; threshold is `importance >= 3` → High/good, else Medium/soon — arbitrary, since importance has no server-enforced scale).

## Groups (Stage 4)

Files: pages/{GroupsPage,GroupDetailsPage}.tsx, organisms/GroupsTable.tsx

```
GroupsPage → getGroups() + getGroupFriends(id) per group (member counts) → GroupsTable 3-col cards → click → GroupDetailsPage
GroupDetailsPage → header (color tile + Delete, ConfirmDialog)
                 → People in this group (real list via getGroupFriends; "+ Add people" modal
                   lists getShortFriendList() minus current members, calls addFriendsToGroup)
                 → Group notes / Settings & permissions (KnowledgeCrudPanel × 2)
```

**Membership is add-only.** `GroupMemberController`/`GroupMemberService` (backend, `friend` module) only expose add + list methods — no remove/unlink endpoint. `[NOT IMPLEMENTED]`: removing a friend from a group needs a new `DELETE` endpoint added there first; don't fake it client-side.

## Insights (Stage 5 — renamed from Analytics)

Files: pages/InsightsPage.tsx, organisms/TrendsPanel.tsx, utils/analyticsMath.ts, utils/friendMetrics.ts

```
KPI strip: Total friends (getFriendsCount) · Overdue (getFriendsThisWeek, days<0) ·
           Avg intensity (calculateIntensityScore over getShortFriendList, mean of >0 scores) ·
           Talked this month (per-friend getFriendAnalytics scoped to current month, summed —
             no aggregate endpoint exists; N+1 calls, fine at this app's dozens-of-friends scale only)
Query bar: Metric (duration/frequency/intensity, SegmentedControl)
         × Friends compare (chips + "+Add" popover, up to N friends, each own avatarColor(id))
         × Timeline (ANALYTICS_RANGES pills, shared with TrendsPanel)
         → Chart.js multi-line chart, one dataset per compared friend via computeAnalyticsSeries
Needs attention: same overdueFriends list as the KPI, sorted ascending, click → Profile
AI analysis panel: [PLANNED — no cross-friend AI backend exists]
```

To add a friend to the compare set programmatically or change the max comparable friends: `InsightsPage.tsx`'s `compareIds` state (currently unbounded).

## Forms (Stage 6)

Files: organisms/{AddFriendForm,KnowledgeEditor,CreateGroupForm}.tsx, molecules/RatingPicker.tsx

Pure visual restyle over Settings/AddFriend/CreateGroup — no functional change except: AddFriendForm's "How was the last chat?" field moved from a `<select>` to `RatingPicker` (same value set), and CreateGroupPage's success feedback moved from FlashMessage-then-1.5s-delay to toast-and-navigate-immediately (same pattern QuickLogModal already used).

## Settings

Files: pages/SettingsPage.tsx, services/api/settingsService.ts

Control panel over **two unrelated backend services** — not touched by the redesign except visuals:
- AI mode + cloud provider keys — `ai_agent`'s `routers/settings.py` (`/api/ai/settings/llm`, `.../providers/{provider}`, `.../host-wrapper-status`). See [[communicator-llm-settings]].
- Google Drive backup/restore — `backup` Java package inside the `communicator-app` JVM monolith (`BackupController`, `/backup/**`). See [[communicator-jvm-monolith]].

No shared organism reuse here — mode-radio cards, provider-key rows, backup cards are one-off layouts local to `SettingsPage.tsx` behind a small local `Card` wrapper.

## Seams

**Outbound:** browser → main nginx `/api/friend/...`, `/api/groups/...`, `/api/ai/...`, `/backup/...` → `communicator-app:8080` (Friend/Groups/Backup) or `ai_agent` (AI). Relative `/api/...` is correct since the SPA is always reached through `/app/` on the same origin — see `services/api/config.ts`.

**Real today:** everything in `friendService.ts`, `groupService.ts`, `settingsService.ts`, `profileAiService.ts`. `connectionService.ts` is still a placeholder (returns empty arrays/logs to console) — unrelated to the redesign, never had a real backend.

## Known gaps (flagged, not silently faked)

- **Group membership is add-only** — no remove/unlink endpoint (`GroupMemberController`). `[NOT IMPLEMENTED]`
- **Media modal "Size" always shows "Unknown"** — `resourceRepository/flask-template` has no `GET /info/<friendId>/<fileName>` route; `MediaGallery`'s fetch 404s and falls back silently. Needs a Flask route added, out of scope for this React-only redesign pass. `[NOT IMPLEMENTED]`
- **Profile Overview's "People & relationships"/"Upcoming"/"Topics to discuss"** and **Insights' "AI analysis"** are designed empty-state placeholders — no backend entity/endpoint exists for any of them. `[NOT IMPLEMENTED]`

## Technology Notes

- **`react-ui` is a baked Docker image.** Editing anything under `react/` does nothing to the running container until `docker compose build react-ui && docker compose up -d react-ui`. No local Node — type-check via `docker run --rm -v "$(pwd)":/app -w /app node:20 npx tsc --noEmit` (no `package-lock.json`/`.tsbuildinfo` committed — both gitignored, regenerate from `package.json`).
- **`Router` needs `basename="/app"`** — proxy_pass strips the `/app` prefix before react-ui ever sees the request. Without it every route silently 404s once actually deployed through nginx.
- **CRA detects the `/app/` mount from `package.json`'s `homepage` field** and prefixes built asset URLs accordingly. Don't remove that field.
- **Toast is a single global slot, not a queue.** `ToastProvider` (wraps the whole app in `App.tsx`) holds exactly one `{message, variant}` at a time with a 2.6s auto-dismiss timer; a second `showToast()` call while one is showing replaces it outright rather than queuing. Fine for this app's UX (one action at a time) but would need a real queue if that ever changes.
- **No state manager / data-fetching lib** — each page manages its own `useState`/`useEffect` fetch. Revisit if pages ever need to share server state (e.g. a friend-count badge in the nav).
- **`FriendService.findById` (Java) returns a blank `new Friend()` (id == null) for a missing id, not null.** Check `.getId() == null`, not `== null`, anywhere this method is used to decide "found vs not."
- **Insights' "Talked this month" is N+1 network calls** (one `getFriendAnalytics` per friend, scoped to the current month) — no aggregate backend endpoint exists. Acceptable at this app's personal-CRM scale (dozens of friends, one page load); would need a real aggregate endpoint before this app could ever support more than that.
- **`avatarColor(id)`** (`utils/avatar.ts`) is the one deterministic-color source reused everywhere a per-entity color is needed without real data (friend initials tiles, Insights compare-chart lines, Groups' color tiles) — a fixed 8-color palette keyed by `id % 8`, not a design field on any entity.

## Change Index

| Thing to change | Where |
|---|---|
| Accent color (re-theme) | `src/styles/globals.css` `--accent`/`--accent-light`/`--accent-lighter`/`--accent-grad-from`/`-to` |
| Design tokens (color/font/radius/shadow scale) | `tailwind.config.js` `theme.extend` |
| Add a route | `App.tsx` `<Routes>` + `utils/constants.ts` `ROUTES` |
| Nav links / destinations | `components/organisms/NavigationBar/NavigationBar.tsx` `NAV_ITEMS` |
| Friends-list / Insights coloring thresholds (days-diff, intensity) | `utils/friendMetrics.ts` |
| EMA smoothing / per-friend series | `utils/analyticsMath.ts` `computeAnalyticsSeries`, `ANALYTICS_RANGES` |
| Week board bucketing / friend-box coloring | `components/organisms/CalendarBoard/CalendarBoard.tsx` |
| Quick-log / edit-details flows | `components/organisms/QuickLogModal`, `components/organisms/TalkedForm` (used inline in ProfilePage's edit modal) |
| Group membership (add people) | `services/api/friendService.ts` (`getGroupFriends`/`addFriendsToGroup`/`getFriendGroupIds`), `components/pages/GroupDetailsPage.tsx` |
| Group notes / settings CRUD, importance→tag mapping | `components/organisms/KnowledgeCrudPanel.tsx` (`importanceFormat` prop), `services/api/groupService.ts` |
| Per-friend knowledge (Overview Raw tab) | `services/api/friendService.ts` (`getFriendKnowledge`/`addFriendKnowledgeItem`/`deleteFriendKnowledgeItem`) |
| Insights KPIs / compare chart | `components/pages/InsightsPage.tsx` |
| AI mode / cloud provider keys | `ai_agent/routers/settings.py`, `services/api/settingsService.ts`, `components/pages/SettingsPage.tsx` |
| Google Drive backup/restore | `backup/.../BackupController.java`, `services/api/settingsService.ts`, `components/pages/SettingsPage.tsx` |
| AI knowledge summary / chat widget | `ai_agent/routers/{knowledge,chat}.py`, `services/api/profileAiService.ts`, `components/organisms/{KnowledgeSummaryTable,AiChatWidget}` |
| Media gallery (upload/primary/delete/pagination) | `FileController` (Java), `services/api/friendService.ts` media functions, `components/organisms/MediaGallery` |
| Social/contact links CRUD | `SocialController` (note lowercase `url` wire key despite Java field `URL`), `services/api/friendService.ts` social functions, `components/organisms/SocialsPanel` |
| Confirm/Toast UI | `components/molecules/{ConfirmDialog,Toast}` |
| SPA mount path (ingress) | `nginx/nginx.conf` `location /app/` (main nginx) |
| SPA client-route fallback | `react/nginx.conf` (react-ui's own nginx) |
| Build/serve | `react/Dockerfile` (CRA build → nginx:alpine), rebuild `react-ui` image to deploy |
