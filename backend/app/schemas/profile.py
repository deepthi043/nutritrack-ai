from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class ProfileCreate(BaseModel):
    age: Optional[int] = None
    height_cm: Optional[float] = None
    weight_kg: Optional[float] = None
    activity_preference: Optional[str] = None
    daily_step_goal: int = 10000
    weekly_active_minutes_goal: int = 300
    daily_water_goal_ml: int = 2500


class ProfileUpdate(ProfileCreate):
    pass


class ProfileResponse(BaseModel):
    id: int
    user_id: int
    age: Optional[int] = None
    height_cm: Optional[float] = None
    weight_kg: Optional[float] = None
    activity_preference: Optional[str] = None
    daily_step_goal: int
    weekly_active_minutes_goal: int
    daily_water_goal_ml: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
