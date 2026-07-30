"""Shared harness for planner services (restaurant matcher, gift-budget, cost-split, ...).

Each planner supplies its own Pydantic input schema and deterministic solve_fn;
PlannerHarness owns the LLM-extract -> validate -> solve plumbing they all share.
"""

from .base import PlannerHarness, ExtractionError

__all__ = ["PlannerHarness", "ExtractionError"]
