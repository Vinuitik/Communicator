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

## Documentation is part of the task, not a follow-up

Before finishing ANY implementation work in this repo — whether you're the top-level session or a spawned subagent working in a worktree — write or update a `FLOWS.md`/`PROTO.md` for whatever module you touched, co-located with the code. This applies even if your task prompt didn't mention it. A new Maven/Python module with no FLOWS.md is an incomplete task, not a follow-up someone will do later.

- Cover: what the module does, its entry points, how it's wired to the rest of the app, and a Change Index (one row per touchable thing → exact class/method/config).
- If a flow spans multiple modules (e.g. a JVM module calling a Python service), also update or add a file under `flows/`.
- This rule exists because it has already been skipped once: several parallel subagents built the `meeting` module and a cross-entity search feature across a full session with zero FLOWS.md coverage, because their task prompts were detailed about the code but never mentioned docs. Don't rely on a prompt to say this explicitly — it's a standing requirement of working in this repo.
