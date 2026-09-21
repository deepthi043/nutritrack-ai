from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class GoalCreate(BaseModel):
    goal_type: str
    target_value: float
    unit: str
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None


class GoalUpdate(BaseModel):
    target_value: Optional[float] = None
    unit: Optional[str] = None
    end_date: Optional[datetime] = None
    is_active: Optional[int] = None


class GoalResponse(BaseModel):
    id: int
    user_id: int
    goal_type: str
    target_value: float
    unit: str
    start_date: datetime
    end_date: Optional[datetime] = None
    is_active: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
