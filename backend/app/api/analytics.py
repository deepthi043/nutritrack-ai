from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.schemas.analytics import ActivityAnalytics, WaterAnalytics, AnalyticsSummary
from app.api.deps import get_current_user
from app.services import analytics_service

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


@router.get("/summary", response_model=AnalyticsSummary)
def get_summary(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Combined weekly activity and water analytics, and consistency score."""
    return analytics_service.get_analytics_summary(db, current_user.id)


@router.get("/activity", response_model=ActivityAnalytics)
def get_activity_analytics(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return analytics_service.get_activity_analytics(db, current_user.id)


@router.get("/water", response_model=WaterAnalytics)
def get_water_analytics(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return analytics_service.get_water_analytics(db, current_user.id)


@router.get("/weekly", response_model=AnalyticsSummary)
def get_weekly(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Alias of /summary — kept for API-shape parity with the spec's requested
    /api/analytics/weekly endpoint."""
    return analytics_service.get_analytics_summary(db, current_user.id)
