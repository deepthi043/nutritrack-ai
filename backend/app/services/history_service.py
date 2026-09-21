"""Combined per-day history: activity + water in one row per day.

All totals are computed via SQL aggregation (SUM/GROUP BY) and merged in
Python only to line up the two sources' rows by date — no per-row
Python-side summation of raw records.
"""

from datetime import datetime, timedelta, date as date_cls

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.activity import ActivityRecord
from app.models.water import WaterRecord
from app.schemas.history import HistoryDayEntry


def get_history(db: Session, user_id: int, start_date: date_cls, end_date: date_cls) -> list[HistoryDayEntry]:
    """Combined daily history for [start_date, end_date] inclusive, newest first."""
    start = datetime.combine(start_date, datetime.min.time())
    end = datetime.combine(end_date, datetime.min.time()) + timedelta(days=1)

    activity_rows = (
        db.query(
            func.date(ActivityRecord.date).label("day"),
            func.sum(ActivityRecord.steps).label("steps"),
            func.sum(ActivityRecord.distance_km).label("distance_km"),
            func.sum(ActivityRecord.active_minutes).label("active_minutes"),
        )
        .filter(ActivityRecord.user_id == user_id, ActivityRecord.date >= start, ActivityRecord.date < end)
        .group_by(func.date(ActivityRecord.date))
        .all()
    )

    water_rows = (
        db.query(
            func.date(WaterRecord.consumed_at).label("day"),
            func.sum(WaterRecord.amount_ml).label("amount_ml"),
        )
        .filter(WaterRecord.user_id == user_id, WaterRecord.consumed_at >= start, WaterRecord.consumed_at < end)
        .group_by(func.date(WaterRecord.consumed_at))
        .all()
    )

    def _to_day(value) -> date_cls:
        return value if isinstance(value, date_cls) else datetime.strptime(value, "%Y-%m-%d").date()

    activity_by_day = {_to_day(r.day): r for r in activity_rows}
    water_by_day = {_to_day(r.day): r for r in water_rows}

    # Include every day in the range, even fully-empty ones, so the history
    # table always reflects the requested range rather than silently
    # dropping days with nothing logged.
    full_range = []
    cursor = end_date
    while cursor >= start_date:
        full_range.append(cursor)
        cursor -= timedelta(days=1)

    result = []
    for day in full_range:
        activity = activity_by_day.get(day)
        water = water_by_day.get(day)

        result.append(
            HistoryDayEntry(
                date=day.isoformat(),
                steps=int(activity.steps or 0) if activity else 0,
                distance_km=round(activity.distance_km or 0, 2) if activity else 0.0,
                active_minutes=int(activity.active_minutes or 0) if activity else 0,
                water_ml=int(water.amount_ml or 0) if water else 0,
            )
        )

    return result
