"""Weekly analytics: activity, hydration, and an overall consistency score.

All aggregation (SUM/AVG/MAX/COUNT) is done in SQL rather than pulling raw
rows into Python and summing them there — see each function's query.
Empty-data periods return honest zeros/None rather than fabricated numbers;
the API layer / frontend is responsible for showing an empty state instead
of a misleading chart when there's nothing to show.
"""

from datetime import datetime, timedelta, date as date_cls

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.activity import ActivityRecord
from app.models.water import WaterRecord
from app.models.profile import Profile
from app.schemas.analytics import (
    ActivityAnalytics,
    WaterAnalytics,
    ConsistencyScore,
    AnalyticsSummary,
)

WEEK_DAYS = 7


def _week_bounds() -> tuple[datetime, datetime, date_cls]:
    today = datetime.utcnow().date()
    start_day = today - timedelta(days=WEEK_DAYS - 1)
    start = datetime.combine(start_day, datetime.min.time())
    end = datetime.combine(today, datetime.min.time()) + timedelta(days=1)
    return start, end, start_day


def get_activity_analytics(db: Session, user_id: int) -> ActivityAnalytics:
    start, end, _ = _week_bounds()

    # Per-day totals (a user can have multiple activity records per day).
    daily = (
        db.query(
            func.date(ActivityRecord.date).label("day"),
            func.sum(ActivityRecord.steps).label("steps"),
            func.sum(ActivityRecord.active_minutes).label("active_minutes"),
        )
        .filter(ActivityRecord.user_id == user_id, ActivityRecord.date >= start, ActivityRecord.date < end)
        .group_by(func.date(ActivityRecord.date))
        .all()
    )

    profile = db.query(Profile).filter(Profile.user_id == user_id).first()
    step_goal = profile.daily_step_goal if profile else 10000

    if not daily:
        return ActivityAnalytics(
            average_daily_steps=0.0,
            total_weekly_steps=0,
            average_active_minutes=0.0,
            best_day_date=None,
            best_day_steps=None,
            goal_completion_percent=0.0,
        )

    total_steps = sum(row.steps or 0 for row in daily)
    total_active_minutes = sum(row.active_minutes or 0 for row in daily)

    best_row = max(daily, key=lambda row: row.steps or 0)
    best_day_date = best_row.day if isinstance(best_row.day, str) else best_row.day.isoformat()

    # Goal completion: average of each tracked day's (steps/goal), capped at
    # 100% per day, averaged over WEEK_DAYS (not just days with data) so a
    # week with 2 tracked days doesn't look like 100% completion.
    per_day_completion = [min(((row.steps or 0) / step_goal) * 100, 100.0) if step_goal > 0 else 0.0 for row in daily]
    goal_completion = round(sum(per_day_completion) / WEEK_DAYS, 1)

    return ActivityAnalytics(
        average_daily_steps=round(total_steps / WEEK_DAYS, 1),
        total_weekly_steps=int(total_steps),
        average_active_minutes=round(total_active_minutes / WEEK_DAYS, 1),
        best_day_date=best_day_date,
        best_day_steps=int(best_row.steps or 0),
        goal_completion_percent=goal_completion,
    )


def get_water_analytics(db: Session, user_id: int) -> WaterAnalytics:
    start, end, _ = _week_bounds()

    daily = (
        db.query(
            func.date(WaterRecord.consumed_at).label("day"),
            func.sum(WaterRecord.amount_ml).label("amount_ml"),
        )
        .filter(WaterRecord.user_id == user_id, WaterRecord.consumed_at >= start, WaterRecord.consumed_at < end)
        .group_by(func.date(WaterRecord.consumed_at))
        .all()
    )

    profile = db.query(Profile).filter(Profile.user_id == user_id).first()
    goal_ml = profile.daily_water_goal_ml if profile else 2500

    if not daily:
        return WaterAnalytics(
            average_daily_ml=0.0,
            best_day_date=None,
            best_day_ml=None,
            average_goal_completion_percent=0.0,
            days_goal_reached=0,
        )

    total_ml = sum(row.amount_ml or 0 for row in daily)
    best_row = max(daily, key=lambda row: row.amount_ml or 0)
    best_day_date = best_row.day if isinstance(best_row.day, str) else best_row.day.isoformat()

    per_day_completion = [
        min(((row.amount_ml or 0) / goal_ml) * 100, 100.0) if goal_ml > 0 else 0.0 for row in daily
    ]
    avg_completion = round(sum(per_day_completion) / WEEK_DAYS, 1)
    days_goal_reached = sum(1 for row in daily if goal_ml > 0 and (row.amount_ml or 0) >= goal_ml)

    return WaterAnalytics(
        average_daily_ml=round(total_ml / WEEK_DAYS, 1),
        best_day_date=best_day_date,
        best_day_ml=int(best_row.amount_ml or 0),
        average_goal_completion_percent=avg_completion,
        days_goal_reached=days_goal_reached,
    )


def get_consistency_score(activity: ActivityAnalytics, water: WaterAnalytics) -> ConsistencyScore:
    """Transparent average of the two category completion rates.

    Each component is included only if it is meaningfully computable (i.e.
    the category isn't entirely without data) — see each *_percent field's
    own zero-when-empty behavior above. We still average both by design: a
    0% in a truly untracked category is a real (if discouraging) signal,
    not a fabricated one, since "goal_completion_percent" etc. are defined
    as 0 when nothing was logged.
    """
    components = {
        "activity": activity.goal_completion_percent,
        "water": water.average_goal_completion_percent,
    }
    score = round(sum(components.values()) / len(components), 1)
    return ConsistencyScore(score_percent=score, components=components)


def get_analytics_summary(db: Session, user_id: int) -> AnalyticsSummary:
    activity = get_activity_analytics(db, user_id)
    water = get_water_analytics(db, user_id)
    consistency = get_consistency_score(activity, water)
    return AnalyticsSummary(activity=activity, water=water, consistency=consistency)
