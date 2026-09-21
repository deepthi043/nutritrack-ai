from datetime import date as date_cls
from typing import Optional

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.schemas.water import WaterRecordCreate, WaterRecordResponse, TodayWaterResponse, DailyWaterPoint
from app.api.deps import get_current_user
from app.services import water_service

router = APIRouter(prefix="/api/water", tags=["water"])


@router.get("/today", response_model=TodayWaterResponse)
def get_today_water(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return water_service.get_today_summary(db, current_user.id)


@router.get("/today/entries", response_model=list[WaterRecordResponse])
def get_today_water_entries(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Individual water log entries for today, for a per-entry timeline view."""
    return water_service.get_today_entries(db, current_user.id)


@router.post("", response_model=WaterRecordResponse, status_code=status.HTTP_201_CREATED)
def add_water(
    payload: WaterRecordCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Log a water entry for the authenticated user. Ownership always comes
    from the JWT — never from the request body."""
    return water_service.create_water_record(db, current_user.id, payload)


@router.get("/history", response_model=list[WaterRecordResponse])
def get_water_history(
    start_date: Optional[date_cls] = Query(default=None),
    end_date: Optional[date_cls] = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return water_service.get_history(db, current_user.id, start_date, end_date, limit)


@router.get("/weekly", response_model=list[DailyWaterPoint])
def get_weekly_water(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return water_service.get_weekly_summary(db, current_user.id)


@router.delete("/{record_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_water(
    record_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    water_service.delete_water_record(db, current_user.id, record_id)
