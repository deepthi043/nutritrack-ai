from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional

# A generous but sane upper bound — guards against unit-entry mistakes
# (e.g. someone typing liters into an ml field) without being paternalistic
# about genuinely high fluid intake.
MAX_REASONABLE_ML = 10000


class WaterRecordCreate(BaseModel):
    consumed_at: Optional[datetime] = None
    amount_ml: int = Field(gt=0, le=MAX_REASONABLE_ML, description="Amount must be a positive, reasonable value")


class WaterRecordResponse(BaseModel):
    id: int
    user_id: int
    consumed_at: datetime
    amount_ml: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class TodayWaterResponse(BaseModel):
    date: str
    total_ml: int
    goal_ml: int
    progress_percent: float
    # See water_service.recommended_goal_ml — a general wellness estimate
    # based on the user's weight, shown alongside the real (possibly
    # user-customized) goal_ml above. Never presented as a medical
    # prescription, and never silently overwrites a goal the user set.
    recommended_goal_ml: Optional[int] = None
    is_using_recommended_goal: bool = False


class DailyWaterPoint(BaseModel):
    date: str
    amount_ml: int
