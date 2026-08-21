# Planner Harness — Proto

Files: base.py

## Role

Shared plumbing for a family of planners (restaurant matcher, gift-budget, cost-split —
schemas/solvers land in later cards). Each planner is just an input `BaseModel` + a
`solve_fn`; this harness owns getting from raw text to a validated instance and from
there to a deterministic answer. No planner-specific code lives here yet.

## Flow

```
raw_text ──► PlannerHarness.extract(llm, raw_text)   LLM fills input_schema, never decides
               │  schema-as-JSON in system prompt
               │  llm.ainvoke([SystemMessage, HumanMessage]) → utils.json_parser.fix_json_format
               │  input_schema.model_validate(parsed)
               │  on JSONDecodeError/ValidationError: retry (max_retries), error fed back to LLM
               ▼
        validated InputT
               │
               ▼
PlannerHarness.solve(validated_input) = solve_fn(validated_input)   pure Python / OR-Tools CP-SAT
               ▼
          SolutionT
```

`PlannerHarness.run(llm, raw_text)` chains both steps. `extract`/`solve` are also public
individually — a caller can `solve()` directly on user-edited structured input without
going back through the LLM.

To change the extraction prompt: `PlannerHarness.__init__(extraction_hint=...)` (per-planner
addendum appended to `EXTRACTION_SYSTEM_TEMPLATE`).
To change retry budget: `PlannerHarness(max_retries=...)` (default 2 → 3 total attempts).

## Technology Notes

- **Extraction is manual JSON-parse-and-validate, not `.with_structured_output()`.**
  `HostWrapperChatModel` (`services/host_wrapper_chat_model.py`) only implements
  `_agenerate` and has no tool-calling/function-calling support, so LangChain's
  structured-output helpers (which need `bind_tools`) don't work uniformly across both
  LLM modes (`ollama` vs `cloud`). This harness instead puts `input_schema.model_json_schema()`
  straight into the system prompt and reuses `utils.json_parser.fix_json_format` — the
  same recovery helper `prompts/summary_prompt_service.py` already relies on — then
  validates with Pydantic. If `HostWrapperChatModel` ever grows tool-calling, structured
  output becomes an option, but it isn't one today.
- **The LLM cannot affect the outcome, only the shape of the input.** `solve_fn` receives
  a validated Pydantic instance and returns a validated Pydantic solution; nothing in
  `solve()` calls back into the LLM. This is deliberate — the whole point of the harness
  is that a hallucinated number in extraction fails Pydantic validation (wrong type/range)
  before it ever reaches the solver, and the solver's arithmetic/constraint logic is
  ordinary deterministic Python (or OR-Tools CP-SAT), so the same input always yields the
  same answer.
- **OR-Tools CP-SAT chosen over PuLP** — no solver library existed in `ai_agent/requirements.txt`
  before this. CP-SAT handles the discrete/combinatorial shape the planned planners need
  (assignment for restaurant matching, integer allocation for gift-budget, subset/partition
  for cost-split) without needing a separate LP vs. MIP vs. CP library per planner. `ortools`
  is pure-Python-installable (no license, ships prebuilt wheels) — added as a plain
  `requirements.txt` entry, no other repo changes needed to use it.
- **Retry loop is bounded and re-prompts with the failure, not silent-default.** Unlike
  `FactValidationService` (which fail-closes to `False, 0.0` on a parse error) or
  `fix_json_format` alone (which returns an `{"error": ...}` dict), this harness treats a
  bad first response as recoverable: it re-sends the LLM's own validation error and asks it
  to fix the JSON, up to `max_retries` times, before raising `ExtractionError`. A planner
  service is expected to catch `ExtractionError` and turn it into a user-facing "couldn't
  understand the request" response rather than let a 3rd bad JSON blob propagate as data.

## Change Index

| Thing to change | Where |
|---|---|
| Extraction system prompt / schema framing | `base.py EXTRACTION_SYSTEM_TEMPLATE` |
| Retry-with-error prompt | `base.py RETRY_SUFFIX_TEMPLATE` |
| Retry budget | `PlannerHarness(max_retries=...)` |
| JSON recovery from raw LLM text | `utils/json_parser.py fix_json_format` (shared with `prompts/summary_prompt_service.py`) |
| Add a concrete planner | new module under `services/planners/`, define an input `BaseModel` + `solve_fn(input) -> SolutionT`, instantiate `PlannerHarness(input_schema=..., solve_fn=...)` |
| Solver dependency | `ai_agent/requirements.txt` (`ortools`) |
