"""Business logic for recording and retrieving activity data.

Kept independent of FastAPI so it can be unit tested and reused (e.g. by the
future AI insight service) without going through HTTP.
"""

from datetime import datetime, timedelta, date as date_cls
from typing import Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.activity import ActivityRecord
from app.models.profile import Profile
from app.schemas.activity import ActivityRecordCreate, ActivitySyncRequest
from app.services.activity_provider import get_default_activity_provider


def _day_bounds(day: date_cls) -> tuple[datetime, datetime]:
    start = datetime.combine(day, datetime.min.time())
    end = start + timedelta(days=1)
    return start, end


def create_activity_record(db: Session, user_id: int, payload: ActivityRecordCreate) -> ActivityRecord:
    """Validate and persist a new activity record via the active provider."""
    provider = get_default_activity_provider()
    normalized = provider.normalize(payload.model_dump())

    record = ActivityRecord(
        user_id=user_id,
        date=normalized.date or datetime.utcnow(),
        steps=normalized.steps,
        distance_km=normalized.distance_km,
        active_minutes=normalized.active_minutes,
        activity_type=normalized.activity_type,
        data_source=normalized.data_source,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def sync_activity_record(db: Session, user_id: int, payload: ActivitySyncRequest) -> tuple[ActivityRecord, bool]:
    """Idempotently upsert a device's daily cumulative activity total.

    Unlike `create_activity_record` (which always inserts a new additive
    row for manual/mock entries), this represents "the platform's current
    running total for this day" — repeated calls with the same or an
    updated total for the same (user, day, source) update one row in
    place rather than creating duplicates or summing totals across syncs.

    Returns (record, was_updated) — was_updated is False the first time a
    given (day, source) is synced, True on every subsequent sync of that
    same day/source.
    """
    existing = (
        db.query(ActivityRecord)
        .filter(
            ActivityRecord.user_id == user_id,
            ActivityRecord.sync_day == payload.date,
            ActivityRecord.data_source == payload.source,
        )
        .first()
    )

    if existing:
        existing.steps = payload.steps
        existing.distance_km = payload.distance_km
        existing.active_minutes = payload.active_minutes
        existing.date = datetime.combine(payload.date, datetime.min.time())
        db.commit()
        db.refresh(existing)
        return existing, True

    record = ActivityRecord(
        user_id=user_id,
        date=datetime.combine(payload.date, datetime.min.time()),
        sync_day=payload.date,
        steps=payload.steps,
        distance_km=payload.distance_km,
        active_minutes=payload.active_minutes,
        data_source=payload.source,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record, False


def get_today_summary(db: Session, user_id: int, local_date: Optional[date_cls] = None) -> dict:
    """Aggregate all of today's activity records plus goal progress.

    `local_date` lets a client (e.g. the mobile app) specify which calendar
    day "today" means in its own timezone. Without it the server falls back
    to its own UTC date — correct for the web app, which has no client-day
    concept of its own, but wrong for a client whose local day has already
    rolled over relative to UTC (e.g. UTC+5:30 in the evening). Passing the
    device's local date avoids a synced record silently missing from
    "today" (or landing on the wrong day) purely due to timezone offset.
    """
    today = local_date or datetime.utcnow().date()
    start, end = _day_bounds(today)

    totals = (
        db.query(
            func.coalesce(func.sum(ActivityRecord.steps), 0),
            func.coalesce(func.sum(ActivityRecord.distance_km), 0.0),
            func.coalesce(func.sum(ActivityRecord.active_minutes), 0),
            func.count(ActivityRecord.id),
        )
        .filter(
            ActivityRecord.user_id == user_id,
            ActivityRecord.date >= start,
            ActivityRecord.date < end,
        )
        .first()
    )
    steps, distance_km, active_minutes, record_count = totals

    profile = db.query(Profile).filter(Profile.user_id == user_id).first()
    step_goal = profile.daily_step_goal if profile else 10000

    progress = round((steps / step_goal) * 100, 1) if step_goal > 0 else 0.0
    progress = min(progress, 100.0)

    return {
        "date": today.isoformat(),
        "steps": steps,
        "distance_km": round(distance_km, 2),
        "active_minutes": active_minutes,
        "step_goal": step_goal,
        "goal_progress_percent": progress,
        "has_activity": record_count > 0,
    }


def get_history(
    db: Session,
    user_id: int,
    start_date: Optional[date_cls] = None,
    end_date: Optional[date_cls] = None,
    limit: int = 100,
) -> list[ActivityRecord]:
    """Return activity records for a user, optionally filtered by date range."""
    query = db.query(ActivityRecord).filter(ActivityRecord.user_id == user_id)

    if start_date:
        query = query.filter(ActivityRecord.date >= datetime.combine(start_date, datetime.min.time()))
    if end_date:
        query = query.filter(
            ActivityRecord.date < datetime.combine(end_date, datetime.min.time()) + timedelta(days=1)
        )

    return query.order_by(ActivityRecord.date.desc()).limit(limit).all()


def get_weekly_summary(db: Session, user_id: int, local_date: Optional[date_cls] = None) -> list[dict]:
    """Return per-day totals for the last 7 days (oldest first), including
    days with no recorded activity as zero-filled entries so the chart
    always shows a full week without fabricating data.

    See get_today_summary for why `local_date` exists — it anchors "the
    last 7 days" on the client's own calendar day instead of always UTC.
    """
    today = local_date or datetime.utcnow().date()
    start_day = today - timedelta(days=6)
    start, _ = _day_bounds(start_day)
    _, end = _day_bounds(today)

    records = (
        db.query(ActivityRecord)
        .filter(
            ActivityRecord.user_id == user_id,
            ActivityRecord.date >= start,
            ActivityRecord.date < end,
        )
        .all()
    )

    totals_by_day: dict[date_cls, dict] = {}
    for record in records:
        day = record.date.date()
        bucket = totals_by_day.setdefault(day, {"steps": 0, "distance_km": 0.0, "active_minutes": 0})
        bucket["steps"] += record.steps
        bucket["distance_km"] += record.distance_km
        bucket["active_minutes"] += record.active_minutes

    result = []
    for offset in range(7):
        day = start_day + timedelta(days=offset)
        bucket = totals_by_day.get(day, {"steps": 0, "distance_km": 0.0, "active_minutes": 0})
        result.append(
            {
                "date": day.isoformat(),
                "steps": bucket["steps"],
                "distance_km": round(bucket["distance_km"], 2),
                "active_minutes": bucket["active_minutes"],
            }
        )
    return result
