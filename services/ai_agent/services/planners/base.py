"""Shared LLM-extract + deterministic-solve harness for planner services.

Planners (restaurant matcher, gift-budget, cost-split, ...) all share the same
two-step shape:

  1. Extract: raw text (attendees, constraints, ...) -> validated Pydantic input
     schema. The LLM only identifies facts already present in the text; it never
     computes the answer.
  2. Solve: validated schema -> deterministic solution, via a pure Python /
     OR-Tools CP-SAT solve function supplied by the concrete planner.

A concrete planner just plugs in its own input schema and solve_fn:

    harness = PlannerHarness(input_schema=MyPlanInput, solve_fn=my_solve)
    solution = await harness.run(llm, raw_text)

Extraction can't use `llm.with_structured_output()` uniformly: HostWrapperChatModel
(services/host_wrapper_chat_model.py) only implements `_agenerate` and has no
tool-calling support, so structured-output/function-calling APIs aren't available
across both LLM modes (ollama vs. cloud). Instead this harness prompts for raw
JSON and reuses utils/json_parser.fix_json_format, the same recovery helper
prompts/summary_prompt_service.py already relies on, then validates the result
against the Pydantic schema with a bounded retry loop that feeds the validation
error back to the LLM.
"""
from __future__ import annotations

import logging
from typing import Callable, Generic, Optional, TypeVar

from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.messages import HumanMessage, SystemMessage
from pydantic import BaseModel, ValidationError

from utils.json_parser import fix_json_format

logger = logging.getLogger(__name__)

InputT = TypeVar("InputT", bound=BaseModel)
SolutionT = TypeVar("SolutionT", bound=BaseModel)

EXTRACTION_SYSTEM_TEMPLATE = (
    "You extract structured data from user text. You do not solve problems, "
    "make decisions, or compute answers - you only identify facts already "
    "present in the text and shape them into JSON.\n\n"
    "Respond with ONLY a JSON object matching this schema, no other text:\n{schema}"
)

RETRY_SUFFIX_TEMPLATE = (
    "\n\nYour previous response failed validation with this error:\n{error}\n"
    "Fix the JSON and respond again with ONLY the corrected JSON object."
)


class ExtractionError(Exception):
    """Raised when the LLM step never produces schema-valid JSON."""


class PlannerHarness(Generic[InputT, SolutionT]):
    """Generic extract-then-solve pipeline that a specific planner configures.

    The LLM (via `extract`) only ever fills `input_schema` fields; `solve_fn`
    is pure Python (or wraps a deterministic solver like OR-Tools CP-SAT) and
    owns the actual answer. Extraction and solving are kept as separate public
    methods so a planner can call solve() directly (e.g. from a test, or after
    accepting user-edited structured input) without going through the LLM.
    """

    def __init__(
        self,
        input_schema: type[InputT],
        solve_fn: Callable[[InputT], SolutionT],
        extraction_hint: str = "",
        max_retries: int = 2,
    ) -> None:
        self.input_schema = input_schema
        self.solve_fn = solve_fn
        self.extraction_hint = extraction_hint
        self.max_retries = max_retries

    async def extract(self, llm: BaseChatModel, raw_text: str) -> InputT:
        """LLM step: raw_text -> validated `input_schema` instance.

        Retries up to `max_retries` times, feeding the previous validation
        error back to the LLM, before raising ExtractionError.
        """
        schema_json = self.input_schema.model_json_schema()
        base_prompt = EXTRACTION_SYSTEM_TEMPLATE.format(schema=schema_json)
        if self.extraction_hint:
            base_prompt += f"\n\n{self.extraction_hint}"

        last_error: Optional[Exception] = None
        for attempt in range(1, self.max_retries + 2):
            system_prompt = base_prompt
            if last_error is not None:
                system_prompt += RETRY_SUFFIX_TEMPLATE.format(error=last_error)

            response = await llm.ainvoke(
                [SystemMessage(content=system_prompt), HumanMessage(content=raw_text)]
            )
            content = response.content if hasattr(response, "content") else str(response)
            parsed = fix_json_format(content)

            if isinstance(parsed, dict) and set(parsed.keys()) == {"error", "raw_response"}:
                last_error = ValueError(f"LLM did not return valid JSON: {parsed['error']}")
                logger.warning("Planner extraction attempt %d/%d: %s", attempt, self.max_retries + 1, last_error)
                continue

            try:
                return self.input_schema.model_validate(parsed)
            except ValidationError as exc:
                last_error = exc
                logger.warning(
                    "Planner extraction attempt %d/%d failed schema validation: %s",
                    attempt, self.max_retries + 1, exc,
                )

        raise ExtractionError(
            f"Failed to extract a valid {self.input_schema.__name__} after "
            f"{self.max_retries + 1} attempt(s): {last_error}"
        )

    def solve(self, validated_input: InputT) -> SolutionT:
        """Solve step: deterministic. The LLM never sees or influences this."""
        return self.solve_fn(validated_input)

    async def run(self, llm: BaseChatModel, raw_text: str) -> SolutionT:
        """Full pipeline: extract structured input via the LLM, then solve deterministically."""
        validated_input = await self.extract(llm, raw_text)
        return self.solve(validated_input)
