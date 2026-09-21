from pydantic import BaseModel


class StreakCounts(BaseModel):
    current: int
    best: int


class StreaksResponse(BaseModel):
    """See app/services/streak_service.py for the exact rules each of
    these three streaks uses — documented once there so mobile and web
    never need (or are able) to diverge (Part 27)."""

    overall: StreakCounts
    steps: StreakCounts
    hydration: StreakCounts


class StreakHistoryDay(BaseModel):
    date: str
    steps: int
    water_ml: int
    step_goal_met: bool
    hydration_goal_met: bool
    overall_goal_met: bool
