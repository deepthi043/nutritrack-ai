"""Schemas for the unified /api/goals endpoint.

Per Phase 2/4 design: per-day and per-week numeric goals (steps, active
minutes, water) live as fields on the user's Profile — there is
deliberately no second, duplicate goal-storage table for these. This
module exposes that same data through a single, goal-shaped API response,
and lets the frontend update one goal at a time without needing to know
it's backed by Profile.
"""

from pydantic import BaseModel, Field
from typing import Optional, Literal

GoalKey = Literal[
    "daily_steps",
    "weekly_active_minutes",
    "daily_water_ml",
]


class GoalItem(BaseModel):
    key: GoalKey
    label: str
    target: float
    unit: str
    category: Literal["activity", "hydration"]


class GoalsResponse(BaseModel):
    goals: list[GoalItem]


class GoalUpdateRequest(BaseModel):
    """Update exactly one named goal's target value."""

    key: GoalKey
    target: float = Field(gt=0, description="Goal target must be greater than 0")


class GoalProgressItem(GoalItem):
    current: float
    progress_percent: float
