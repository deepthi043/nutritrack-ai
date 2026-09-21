"""Business logic for water/hydration tracking.

Follows the same aggregation pattern as activity_service:
SQL-side SUM for totals, zero-filled 7-day buckets for weekly charts, and
progress capped at 100% for display while the underlying total is never
truncated.
"""

from datetime import datetime, timedelta, date as date_cls
from typing import Optional

from sqlalchemy import func
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.models.water import WaterRecord
from app.models.profile import Profile
from app.schemas.water import WaterRecordCreate

# Part 13's formula: daily_target_ml = body_weight_kg * ML_PER_KG. 35 ml/kg
# is a commonly cited general wellness heuristic (not a clinical/medical
# figure) for daily fluid intake — e.g. 60kg -> 2100ml, matching the spec's
# worked example exactly. Deliberately a single configurable constant
# rather than folding in age/sex/activity-level multipliers this project
# has no clinically-reviewed basis for.
ML_PER_KG = 35

# Sane bounds so an unusual weight value can't produce an absurd
# recommendation (e.g. a data-entry typo of 600kg) — the recommendation is
# clamped, never silently unbounded.
MIN_RECOMMENDED_ML = 1200
MAX_RECOMMENDED_ML = 5000


def _day_bounds(day: date_cls) -> tuple[datetime, datetime]:
    start = datetime.combine(day, datetime.min.time())
    return start, start + timedelta(days=1)


def calculate_recommended_goal_ml(weight_kg: Optional[float]) -> Optional[int]:
    """Part 13: a general wellness ESTIMATE, not a medical prescription —
    returns None when weight is unavailable rather than inventing a number
    (the existing configured/default goal is used in that case, per spec)."""
    if not weight_kg or weight_kg <= 0:
        return None
    raw = weight_kg * ML_PER_KG
    return int(round(min(max(raw, MIN_RECOMMENDED_ML), MAX_RECOMMENDED_ML)))


def create_water_record(db: Session, user_id: int, payload: WaterRecordCreate) -> WaterRecord:
    record = WaterRecord(
        user_id=user_id,
        amount_ml=payload.amount_ml,
        consumed_at=payload.consumed_at or datetime.utcnow(),
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def delete_water_record(db: Session, user_id: int, record_id: int) -> None:
    record = db.query(WaterRecord).filter(WaterRecord.id == record_id, WaterRecord.user_id == user_id).first()
    if record is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Water record not found")
    db.delete(record)
    db.commit()


def get_today_summary(db: Session, user_id: int) -> dict:
    today = datetime.utcnow().date()
    start, end = _day_bounds(today)

    total_ml = (
        db.query(func.coalesce(func.sum(WaterRecord.amount_ml), 0))
        .filter(WaterRecord.user_id == user_id, WaterRecord.consumed_at >= start, WaterRecord.consumed_at < end)
        .scalar()
    )

    profile = db.query(Profile).filter(Profile.user_id == user_id).first()
    recommended_ml = calculate_recommended_goal_ml(profile.weight_kg if profile else None)

    if profile and recommended_ml and not profile.water_goal_manually_set:
        # Part 13: auto-apply the weight-based recommendation as the
        # actual goal for as long as the user hasn't explicitly chosen
        # their own value — this is what makes the goal "automatically
        # estimated" rather than merely advisory-but-unused. Once
        # water_goal_manually_set is True (see goal_service.update_goal),
        # this branch never runs again for that user.
        if profile.daily_water_goal_ml != recommended_ml:
            profile.daily_water_goal_ml = recommended_ml
            db.commit()
            db.refresh(profile)

    goal_ml = profile.daily_water_goal_ml if profile else 2500

    # Progress is capped at 100% for display, but total_ml above always
    # retains the real, uncapped amount consumed.
    progress = round((total_ml / goal_ml) * 100, 1) if goal_ml > 0 else 0.0
    progress = min(progress, 100.0)

    return {
        "date": today.isoformat(),
        "total_ml": total_ml,
        "goal_ml": goal_ml,
        "progress_percent": progress,
        "recommended_goal_ml": recommended_ml,
        "is_using_recommended_goal": bool(profile and not profile.water_goal_manually_set and recommended_ml is not None),
    }


def get_today_entries(db: Session, user_id: int) -> list[WaterRecord]:
    today = datetime.utcnow().date()
    start, end = _day_bounds(today)
    return (
        db.query(WaterRecord)
        .filter(WaterRecord.user_id == user_id, WaterRecord.consumed_at >= start, WaterRecord.consumed_at < end)
        .order_by(WaterRecord.consumed_at.asc())
        .all()
    )


def get_history(
    db: Session,
    user_id: int,
    start_date: Optional[date_cls] = None,
    end_date: Optional[date_cls] = None,
    limit: int = 100,
) -> list[WaterRecord]:
    query = db.query(WaterRecord).filter(WaterRecord.user_id == user_id)

    if start_date:
        query = query.filter(WaterRecord.consumed_at >= datetime.combine(start_date, datetime.min.time()))
    if end_date:
        query = query.filter(
            WaterRecord.consumed_at < datetime.combine(end_date, datetime.min.time()) + timedelta(days=1)
        )

    return query.order_by(WaterRecord.consumed_at.desc()).limit(limit).all()


def get_weekly_summary(db: Session, user_id: int) -> list[dict]:
    """Per-day water totals for the last 7 days (oldest first), zero-filled
    for days with no entries so the chart always shows a full week."""
    today = datetime.utcnow().date()
    start_day = today - timedelta(days=6)
    start, _ = _day_bounds(start_day)
    _, end = _day_bounds(today)

    rows = (
        db.query(WaterRecord.consumed_at, WaterRecord.amount_ml)
        .filter(WaterRecord.user_id == user_id, WaterRecord.consumed_at >= start, WaterRecord.consumed_at < end)
        .all()
    )

    totals_by_day: dict[date_cls, int] = {}
    for consumed_at, amount_ml in rows:
        day = consumed_at.date()
        totals_by_day[day] = totals_by_day.get(day, 0) + amount_ml

    result = []
    for offset in range(7):
        day = start_day + timedelta(days=offset)
        result.append({"date": day.isoformat(), "amount_ml": totals_by_day.get(day, 0)})
    return result
