from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.schemas.unified_goals import GoalUpdateRequest, GoalItem, GoalProgressItem
from app.api.deps import get_current_user
from app.services import goal_service, activity_service, water_service

router = APIRouter(prefix="/api/goals", tags=["goals"])


@router.get("", response_model=list[GoalProgressItem])
def get_goals(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """All of the user's goals with today's (or this week's) progress toward each.

    Progress is calculated from real, already-aggregated data — the same
    activity/water summaries the Activity/Water pages use — never a
    separate hardcoded calculation.
    """
    goals = goal_service.list_goals(db, current_user.id)

    activity_today = activity_service.get_today_summary(db, current_user.id)
    water_today = water_service.get_today_summary(db, current_user.id)

    # Weekly active minutes: sum this week's daily activity records.
    weekly_activity = activity_service.get_weekly_summary(db, current_user.id)
    weekly_active_minutes = sum(day["active_minutes"] for day in weekly_activity)

    current_by_key = {
        "daily_steps": activity_today["steps"],
        "weekly_active_minutes": weekly_active_minutes,
        "daily_water_ml": water_today["total_ml"],
    }

    result = []
    for goal in goals:
        current = current_by_key.get(goal.key, 0)
        progress = round((current / goal.target) * 100, 1) if goal.target > 0 else 0.0
        progress = min(progress, 100.0)
        result.append(
            GoalProgressItem(
                key=goal.key,
                label=goal.label,
                target=goal.target,
                unit=goal.unit,
                category=goal.category,
                current=current,
                progress_percent=progress,
            )
        )
    return result


@router.put("", response_model=GoalItem)
def update_goal(
    payload: GoalUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update one goal's target value (goal identified by `key` in the body)."""
    return goal_service.update_goal(db, current_user.id, payload.key, payload.target)
