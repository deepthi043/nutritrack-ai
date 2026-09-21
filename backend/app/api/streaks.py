from datetime import date as date_cls
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.schemas.streak import StreaksResponse, StreakHistoryDay
from app.api.deps import get_current_user
from app.services import streak_service

router = APIRouter(prefix="/api/streaks", tags=["streaks"])

_LOCAL_DATE_DESCRIPTION = (
    "Client's local calendar date, anchoring streak calculations on the client's own "
    "'today' rather than the server's UTC date (see streak_service for why this matters "
    "for correctness). Defaults to the server's UTC date if omitted."
)


@router.get("", response_model=StreaksResponse)
def get_streaks(
    local_date: Optional[date_cls] = Query(default=None, description=_LOCAL_DATE_DESCRIPTION),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Current and best streaks for steps, hydration, and overall — the
    same calculation used by both mobile and web (Part 27), derived from
    existing ActivityRecord/WaterRecord data rather than a separate
    streak table (Part 26)."""
    return streak_service.get_streaks(db, current_user.id, local_date)


@router.get("/history", response_model=list[StreakHistoryDay])
def get_streak_history(
    days: int = Query(default=7, ge=1, le=90),
    local_date: Optional[date_cls] = Query(default=None, description=_LOCAL_DATE_DESCRIPTION),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Per-day goal-completion flags for the last `days` days (oldest
    first) — backs the "Mon ✅ Tue ❌" style streak history UI (Part 25)."""
    return streak_service.get_streak_history(db, current_user.id, days, local_date)
