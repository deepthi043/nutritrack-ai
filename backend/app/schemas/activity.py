from pydantic import BaseModel, Field
from datetime import datetime, date as date_cls
from typing import Optional, Literal


class ActivityRecordCreate(BaseModel):
    date: Optional[datetime] = None
    steps: int = Field(default=0, ge=0, description="Steps cannot be negative")
    distance_km: float = Field(default=0.0, ge=0, description="Distance cannot be negative")
    active_minutes: int = Field(default=0, ge=0, description="Active minutes cannot be negative")
    activity_type: Optional[str] = None
    data_source: str = "mock"


class ActivityRecordResponse(BaseModel):
    id: int
    user_id: int
    date: datetime
    steps: int
    distance_km: float
    active_minutes: int
    activity_type: Optional[str] = None
    data_source: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class TodayActivityResponse(BaseModel):
    """Aggregated view of today's activity plus goal progress."""

    date: str
    steps: int
    distance_km: float
    active_minutes: int
    step_goal: int
    goal_progress_percent: float
    has_activity: bool


class DailyStepsPoint(BaseModel):
    """One point on the weekly steps chart."""

    date: str
    steps: int
    distance_km: float
    active_minutes: int


ActivitySyncSource = Literal["mock", "android_native", "android_health", "ios_health", "wearable"]


class ActivitySyncRequest(BaseModel):
    """Payload for the idempotent mobile sync endpoint.

    Represents one platform's *current cumulative total* for `date` — not
    an incremental session. Sending the same or an updated total for the
    same (date, source) is always safe and never doubles up; see
    activity_service.sync_activity_record for the upsert logic.
    """

    date: date_cls
    steps: int = Field(ge=0, description="Steps cannot be negative")
    distance_km: float = Field(default=0.0, ge=0, description="Distance cannot be negative")
    active_minutes: int = Field(default=0, ge=0, description="Active minutes cannot be negative")
    source: ActivitySyncSource


class ActivitySyncResponse(BaseModel):
    id: int
    date: str
    steps: int
    distance_km: float
    active_minutes: int
    source: str
    synced_at: datetime
    was_updated: bool  # True if an existing sync record was updated, False if newly created
