"""Streak calculation — derived entirely from existing ActivityRecord and
WaterRecord data (Part 26: no separate streak table). A day "counts" for a
given streak type based on a simple rule compared against the user's
current goal; streaks are computed by walking backward from `today`
(or the client-supplied local date) one day at a time.

Rules (Part 19-21, documented here as the single source of truth so mobile
and web never diverge — Part 27):

- STEP streak: a day counts when that day's total steps (SUM across all
  ActivityRecord rows for the day, matching activity_service.get_today_summary's
  own aggregation — i.e. automatic + manual entries both count, since
  that's already how "today's steps" is defined everywhere else in this
  codebase) >= the user's daily_step_goal AT THE TIME OF CHECKING (the
  live/current goal, not a historical snapshot — this project does not
  track goal-value history, so this is a deliberate simplification,
  documented rather than silently assumed).
- HYDRATION streak: a day counts when that day's total logged water_ml
  >= the user's daily_water_goal_ml (current goal, same caveat as above).
- OVERALL streak: a day counts when BOTH the step and hydration rules are
  satisfied for that day (Part 21's "at minimum" recommendation, adopted
  since no existing overall-goal definition exists in this codebase to
  preserve instead).

"current streak": the number of consecutive qualifying days ending at
"today", walking backward. If today does not yet qualify (goal not met
yet, which is normal mid-day), today simply doesn't count and the streak
is based on yesterday backward — a streak is never held open speculatively
for an incomplete today, and today not qualifying yet does NOT zero out
what came before it, since the user hasn't finished today.

"best streak": the longest run of consecutive qualifying days found across
the maximum lookback window this function scans (LOOKBACK_DAYS below) — an
approximation bounded by that window since there is no persisted
best-streak-ever counter (Part 26 preference against unnecessary state);
documented as a known limitation for very old accounts.
"""

from datetime import date as date_cls, timedelta
from typing import Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.activity import ActivityRecord
from app.models.water import WaterRecord
from app.models.profile import Profile

# How many days back to scan when computing streaks. Bounded rather than
# unbounded so a years-old account doesn't force scanning its entire
# history on every dashboard load; 400 comfortably covers "best streak in
# the last year plus buffer" without being unbounded.
LOOKBACK_DAYS = 400


def _daily_step_totals(db: Session, user_id: int, start_day: date_cls, end_day_exclusive: date_cls) -> dict[date_cls, int]:
    from datetime import datetime

    start = datetime.combine(start_day, datetime.min.time())
    end = datetime.combine(end_day_exclusive, datetime.min.time())

    rows = (
        db.query(func.date(ActivityRecord.date), func.sum(ActivityRecord.steps))
        .filter(ActivityRecord.user_id == user_id, ActivityRecord.date >= start, ActivityRecord.date < end)
        .group_by(func.date(ActivityRecord.date))
        .all()
    )
    result: dict[date_cls, int] = {}
    for day_value, total in rows:
        day = day_value if isinstance(day_value, date_cls) else date_cls.fromisoformat(str(day_value))
        result[day] = int(total or 0)
    return result


def _daily_water_totals(db: Session, user_id: int, start_day: date_cls, end_day_exclusive: date_cls) -> dict[date_cls, int]:
    from datetime import datetime

    start = datetime.combine(start_day, datetime.min.time())
    end = datetime.combine(end_day_exclusive, datetime.min.time())

    rows = (
        db.query(func.date(WaterRecord.consumed_at), func.sum(WaterRecord.amount_ml))
        .filter(WaterRecord.user_id == user_id, WaterRecord.consumed_at >= start, WaterRecord.consumed_at < end)
        .group_by(func.date(WaterRecord.consumed_at))
        .all()
    )
    result: dict[date_cls, int] = {}
    for day_value, total in rows:
        day = day_value if isinstance(day_value, date_cls) else date_cls.fromisoformat(str(day_value))
        result[day] = int(total or 0)
    return result


def _compute_current_and_best(qualifying_days: set[date_cls], today: date_cls, earliest_day: date_cls) -> tuple[int, int]:
    """Walks backward from `today` (or `today - 1` if today doesn't yet
    qualify) counting consecutive qualifying days for `current`, and scans
    the whole window for the longest consecutive run for `best`."""
    # Current streak: start at today if it qualifies, else start counting
    # from yesterday (today not being done yet must not zero the streak).
    cursor = today if today in qualifying_days else today - timedelta(days=1)
    current = 0
    while cursor >= earliest_day and cursor in qualifying_days:
        current += 1
        cursor -= timedelta(days=1)

    # Best streak: scan every day in the window for the longest run.
    best = 0
    run = 0
    day = earliest_day
    while day <= today:
        if day in qualifying_days:
            run += 1
            best = max(best, run)
        else:
            run = 0
        day += timedelta(days=1)

    return current, best


def get_streaks(db: Session, user_id: int, local_date: Optional[date_cls] = None) -> dict:
    """Returns current/best streaks for steps, hydration, and overall.

    `local_date` anchors "today" on the client's own calendar day (Part 22)
    — falls back to server UTC date when omitted, matching the same
    pattern used by GET /api/activity/today.
    """
    from datetime import datetime

    today = local_date or datetime.utcnow().date()
    earliest_day = today - timedelta(days=LOOKBACK_DAYS - 1)

    profile = db.query(Profile).filter(Profile.user_id == user_id).first()
    step_goal = profile.daily_step_goal if profile else 10000
    water_goal = profile.daily_water_goal_ml if profile else 2500

    step_totals = _daily_step_totals(db, user_id, earliest_day, today + timedelta(days=1))
    water_totals = _daily_water_totals(db, user_id, earliest_day, today + timedelta(days=1))

    step_qualifying = {day for day, total in step_totals.items() if step_goal > 0 and total >= step_goal}
    water_qualifying = {day for day, total in water_totals.items() if water_goal > 0 and total >= water_goal}
    overall_qualifying = step_qualifying & water_qualifying

    step_current, step_best = _compute_current_and_best(step_qualifying, today, earliest_day)
    water_current, water_best = _compute_current_and_best(water_qualifying, today, earliest_day)
    overall_current, overall_best = _compute_current_and_best(overall_qualifying, today, earliest_day)

    return {
        "overall": {"current": overall_current, "best": overall_best},
        "steps": {"current": step_current, "best": step_best},
        "hydration": {"current": water_current, "best": water_best},
    }


def get_streak_history(db: Session, user_id: int, days: int = 7, local_date: Optional[date_cls] = None) -> list[dict]:
    """Last `days` days (oldest first) with per-day step/hydration/overall
    completion flags — the data behind the "Mon ✅ Tue ✅ Wed ❌" UI (Part 25)."""
    from datetime import datetime

    today = local_date or datetime.utcnow().date()
    start_day = today - timedelta(days=days - 1)

    profile = db.query(Profile).filter(Profile.user_id == user_id).first()
    step_goal = profile.daily_step_goal if profile else 10000
    water_goal = profile.daily_water_goal_ml if profile else 2500

    step_totals = _daily_step_totals(db, user_id, start_day, today + timedelta(days=1))
    water_totals = _daily_water_totals(db, user_id, start_day, today + timedelta(days=1))

    result = []
    for offset in range(days):
        day = start_day + timedelta(days=offset)
        steps = step_totals.get(day, 0)
        water_ml = water_totals.get(day, 0)
        step_ok = step_goal > 0 and steps >= step_goal
        water_ok = water_goal > 0 and water_ml >= water_goal
        result.append(
            {
                "date": day.isoformat(),
                "steps": steps,
                "water_ml": water_ml,
                "step_goal_met": step_ok,
                "hydration_goal_met": water_ok,
                "overall_goal_met": step_ok and water_ok,
            }
        )
    return result
