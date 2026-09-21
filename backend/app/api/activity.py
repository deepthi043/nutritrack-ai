from datetime import date as date_cls
from typing import Optional

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.schemas.activity import (
    ActivityRecordCreate,
    ActivityRecordResponse,
    TodayActivityResponse,
    DailyStepsPoint,
    ActivitySyncRequest,
    ActivitySyncResponse,
)
from app.api.deps import get_current_user
from app.services import activity_service

router = APIRouter(prefix="/api/activity", tags=["activity"])


@router.get("/today", response_model=TodayActivityResponse)
def get_today_activity(
    local_date: Optional[date_cls] = Query(
        default=None,
        description="Client's local calendar date. Defaults to the server's UTC date if omitted "
        "(used by the web app, which has no client-day concept). Mobile clients should always "
        "pass this to avoid timezone-boundary mismatches — see activity_service.get_today_summary.",
    ),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Today's aggregated activity for the authenticated user, plus step-goal progress."""
    return activity_service.get_today_summary(db, current_user.id, local_date)


@router.post("", response_model=ActivityRecordResponse, status_code=status.HTTP_201_CREATED)
def add_activity(
    payload: ActivityRecordCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Record a new activity entry for the authenticated user.

    The user id is always taken from the authenticated token — never from
    the request body — so a caller can never write activity for another
    account.
    """
    return activity_service.create_activity_record(db, current_user.id, payload)


@router.post("/sync", response_model=ActivitySyncResponse)
def sync_activity(
    payload: ActivitySyncRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Idempotent daily activity sync for mobile/wearable clients.

    Submits the device's *current cumulative total* for one day/source —
    NOT an incremental session. Calling this repeatedly with the same or
    an updated total for the same day is always safe: the server updates
    one row in place per (user, day, source) rather than creating
    duplicates or double-counting. This is distinct from POST /api/activity,
    which stays additive for manual/mock entries (Phase 2 semantics).

    The user id is always taken from the authenticated token — the client
    cannot sync activity for another account.
    """
    record, was_updated = activity_service.sync_activity_record(db, current_user.id, payload)
    return ActivitySyncResponse(
        id=record.id,
        date=payload.date.isoformat(),
        steps=record.steps,
        distance_km=record.distance_km,
        active_minutes=record.active_minutes,
        source=record.data_source,
        synced_at=record.updated_at,
        was_updated=was_updated,
    )


@router.get("/history", response_model=list[ActivityRecordResponse])
def get_activity_history(
    start_date: Optional[date_cls] = Query(default=None),
    end_date: Optional[date_cls] = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Historical activity records for the authenticated user, optionally date-filtered."""
    return activity_service.get_history(db, current_user.id, start_date, end_date, limit)


@router.get("/weekly", response_model=list[DailyStepsPoint])
def get_weekly_activity(
    local_date: Optional[date_cls] = Query(
        default=None,
        description="Client's local calendar date, anchoring the 7-day window. Defaults to the "
        "server's UTC date if omitted.",
    ),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Last 7 days of activity totals (oldest first), zero-filled for days with no data."""
    return activity_service.get_weekly_summary(db, current_user.id, local_date)
