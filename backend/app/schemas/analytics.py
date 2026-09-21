from pydantic import BaseModel
from typing import Optional


class ActivityAnalytics(BaseModel):
    average_daily_steps: float
    total_weekly_steps: int
    average_active_minutes: float
    best_day_date: Optional[str] = None
    best_day_steps: Optional[int] = None
    goal_completion_percent: float  # average of each day's steps/goal, capped at 100 per day


class WaterAnalytics(BaseModel):
    average_daily_ml: float
    best_day_date: Optional[str] = None
    best_day_ml: Optional[int] = None
    average_goal_completion_percent: float
    days_goal_reached: int


class ConsistencyScore(BaseModel):
    """A transparent weekly consistency score.

    Calculated as the plain average of the available category completion
    percentages (activity goal completion, average water goal completion).
    A category is included only when it has an actual computable rate;
    there is no hidden weighting and no fabricated component.
    """

    score_percent: float
    components: dict[str, float]  # e.g. {"activity": 78.0, "water": 72.0}
    formula: str = "Average of available category completion percentages (activity goal, water goal)."


class AnalyticsSummary(BaseModel):
    activity: ActivityAnalytics
    water: WaterAnalytics
    consistency: ConsistencyScore
