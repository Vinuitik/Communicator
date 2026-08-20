## Skill routing

When the user's request matches an available skill, invoke it via the Skill tool. When in doubt, invoke the skill.

Key routing rules:
- Product ideas/brainstorming → invoke /office-hours
- Strategy/scope → invoke /plan-ceo-review
- Architecture → invoke /plan-eng-review
- Design system/plan review → invoke /design-consultation or /plan-design-review
- Full review pipeline → invoke /autoplan
- Bugs/errors → invoke /investigate
- QA/testing site behavior → invoke /qa or /qa-only
- Code review/diff check → invoke /review
- Visual polish → invoke /design-review
- Ship/deploy/PR → invoke /ship or /land-and-deploy
- Save progress → invoke /context-save
- Resume context → invoke /context-restore

## Mental model sync — top priority, overrides "just build it"
The user's mental model of the project must never drift from what's actually built. This is the #1 failure mode in AI-assisted coding (doesn't happen when building manually) and outranks speed.
- Any structural/architecture decision discovered mid-task (new module dependency, moving code/data between modules, a new abstraction) → stop and surface it before acting, even if the answer seems obvious, even if the user said "just build it" / "stop asking" earlier in the session. That green light covers pace, not new forks discovered along the way.
- Surfacing must be laconic — 2-4 lines, plain language, the decision + why it matters. Not a wall of text (walls don't get read, which defeats the purpose — terseness is *how* sync is maintained, not a style preference).
- Applies even under Auto Mode / "don't ask" instructions — this is the one thing worth interrupting for. Applies to every subagent working in this repo, not just the top-level session.

## Laconic style
- Keep responses short. No trailing summaries, no restating what was just done.
- Only ask a question when genuinely blocked. Do not ask multiple clarifying questions proactively.

## Debugging protocol — scientific method

When debugging an issue where the cause is not immediately obvious from code reading alone:

1. **Stop reading code after ~2 files.** More reading without data is speculation, not debugging.
2. **State a hypothesis.** One sentence: "I think X is happening because Y."
3. **Design the minimum test that would confirm or kill the hypothesis.** Prefer tests the user can run in under 60 seconds.
4. **If you need runtime data, write explicit user instructions:**
   - Exactly what to do (open DevTools → Network tab → do X → copy Y)
   - Exactly what to paste back (the full response from endpoint Z, the cookie header, the log line)
5. **Rank hypotheses by likelihood before testing** — test the most likely first.
6. **After data comes back, commit to a conclusion** — do not hedge into more reading. Either the hypothesis is confirmed (fix it) or killed (form next hypothesis).

**Never:** read 10 files speculatively hoping the bug becomes obvious. That burns tokens and wastes the user's time. Data > code reading when the cause is unclear.

## Decision escalation
Non-trivial decisions (architecture, formatting choices with real trade-offs, anything that could cause product drift) must be escalated before acting. Format:

> "Hey boss, we found this non-trivial issue and I need your problem solving too: {description} — {list of options and their trade-offs}"

Trivial = syntax, naming, obvious fixes. Non-trivial = anything where two reasonable engineers would disagree, or where getting it wrong is hard to undo.

## Git commits during todo sessions

When working through a todo list, commit after each completed stage. Rules:
- `git add` only the relevant files (never `-A` blindly)
- Commit message: short imperative, no "Claude" or "Co-authored-by" mention
- Never push
- Never use `--no-verify`

## Documentation is part of the task, not a follow-up

Before finishing ANY implementation work in this repo — whether you're the top-level session or a spawned subagent working in a worktree — write or update a `FLOWS.md`/`PROTO.md` for whatever module you touched, co-located with the code. This applies even if your task prompt didn't mention it. A new Maven/Python module with no FLOWS.md is an incomplete task, not a follow-up someone will do later.

- Cover: what the module does, its entry points, how it's wired to the rest of the app, and a Change Index (one row per touchable thing → exact class/method/config).
- If a flow spans multiple modules (e.g. a JVM module calling a Python service), also update or add a file under `flows/`.
- This rule exists because it has already been skipped once: several parallel subagents built the `meeting` module and a cross-entity search feature across a full session with zero FLOWS.md coverage, because their task prompts were detailed about the code but never mentioned docs. Don't rely on a prompt to say this explicitly — it's a standing requirement of working in this repo.
