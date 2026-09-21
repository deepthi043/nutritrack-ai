from datetime import date as date_cls, timedelta

from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.schemas.history import HistoryDayEntry
from app.api.deps import get_current_user
from app.services import history_service

router = APIRouter(prefix="/api/history", tags=["history"])

MAX_RANGE_DAYS = 366


@router.get("", response_model=list[HistoryDayEntry])
def get_history(
    start_date: date_cls = Query(default=None),
    end_date: date_cls = Query(default=None),
    range: str = Query(default=None, description="Convenience preset: today | last_7_days | last_30_days"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Combined activity + water history, newest day first.

    Either pass `range` (today | last_7_days | last_30_days) or an explicit
    `start_date`/`end_date` pair for a custom range. Defaults to the last 7
    days if nothing is specified.
    """
    today = date_cls.today()

    if range == "today":
        start_date, end_date = today, today
    elif range == "last_30_days":
        start_date, end_date = today - timedelta(days=29), today
    elif range == "last_7_days" or (start_date is None and end_date is None and range is None):
        start_date, end_date = today - timedelta(days=6), today
    elif start_date is None or end_date is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Provide both start_date and end_date for a custom range, or use the range parameter.",
        )

    if start_date > end_date:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="start_date must be on or before end_date")

    if (end_date - start_date).days + 1 > MAX_RANGE_DAYS:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Date range cannot exceed {MAX_RANGE_DAYS} days.",
        )

    return history_service.get_history(db, current_user.id, start_date, end_date)
