"""Unified goal read/update/progress logic.

Goals are stored as fields on Profile (see module docstring in
app/schemas/unified_goals.py for why) — this service is the single place
that maps a goal `key` to its Profile column, so the rest of the app can
work with goals generically instead of hardcoding Profile field names.
"""

from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.models.profile import Profile
from app.schemas.unified_goals import GoalItem, GoalKey

# key -> (profile field name, display label, unit, category)
_GOAL_DEFINITIONS: dict[str, tuple[str, str, str, str]] = {
    "daily_steps": ("daily_step_goal", "Daily Steps", "steps", "activity"),
    "weekly_active_minutes": ("weekly_active_minutes_goal", "Weekly Active Minutes", "minutes", "activity"),
    "daily_water_ml": ("daily_water_goal_ml", "Water", "ml", "hydration"),
}


def _get_or_404(db: Session, user_id: int) -> Profile:
    profile = db.query(Profile).filter(Profile.user_id == user_id).first()
    if profile is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profile not found")
    return profile


def list_goals(db: Session, user_id: int) -> list[GoalItem]:
    profile = _get_or_404(db, user_id)
    items = []
    for key, (field, label, unit, category) in _GOAL_DEFINITIONS.items():
        items.append(
            GoalItem(key=key, label=label, target=getattr(profile, field), unit=unit, category=category)
        )
    return items


def update_goal(db: Session, user_id: int, key: GoalKey, target: float) -> GoalItem:
    profile = _get_or_404(db, user_id)
    field, label, unit, category = _GOAL_DEFINITIONS[key]

    # Integer-backed columns (steps, minutes, water ml, calories) should stay
    # whole numbers; macro grams stay float.
    value = int(round(target)) if isinstance(getattr(profile, field), int) else target
    setattr(profile, field, value)

    if key == "daily_water_ml":
        # Marks this user's hydration goal as explicitly chosen, so the
        # automatic weight-based recommendation (see water_service) never
        # silently overwrites it again — see Profile.water_goal_manually_set.
        profile.water_goal_manually_set = True

    db.commit()
    db.refresh(profile)

    return GoalItem(key=key, label=label, target=value, unit=unit, category=category)
