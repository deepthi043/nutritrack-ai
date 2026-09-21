"""Builds a structured, factual snapshot of a user's data for the AI layer.

This is the ONLY bridge between the database and the AI provider. It never
writes raw SQL itself — it calls the same service functions the
Activity/Water/Goals/Analytics/History APIs already use, so the context an
AI response is based on is guaranteed to be the same real data the user
sees elsewhere in the app. The AI providers (mock or LLM) only ever see the
dict this module returns; they have no database access.

    Database -> {activity,water,goal,analytics}_service -> this module
             -> structured context dict -> AIProvider -> AIService -> API
"""

from sqlalchemy.orm import Session

from app.services import activity_service, water_service, goal_service, analytics_service


def build_daily_context(db: Session, user_id: int) -> dict:
    """Everything needed to describe *today* — mirrors the shape used
    throughout the app (steps, active_minutes, water_liters) plus today's
    goal targets for comparison."""
    activity = activity_service.get_today_summary(db, user_id)
    water = water_service.get_today_summary(db, user_id)
    goals = goal_service.list_goals(db, user_id)

    goal_by_key = {g.key: g.target for g in goals}

    return {
        "date": activity["date"],
        "steps": activity["steps"],
        "active_minutes": activity["active_minutes"],
        "distance_km": activity["distance_km"],
        "step_goal": activity["step_goal"],
        "water_liters": round(water["total_ml"] / 1000, 2),
        "water_goal_liters": round(water["goal_ml"] / 1000, 2),
    }


def build_weekly_context(db: Session, user_id: int) -> dict:
    """Everything needed to describe the last 7 days — reuses the same
    analytics aggregation the Analytics page shows (averages, best day,
    goal completion, consistency)."""
    summary = analytics_service.get_analytics_summary(db, user_id)

    return {
        "activity": summary.activity.model_dump(),
        "water": summary.water.model_dump(),
        "consistency": summary.consistency.model_dump(),
    }


def build_chat_context(db: Session, user_id: int) -> dict:
    """Broader context for free-form questions: today's snapshot, the
    weekly summary, and recent activity history — enough to answer
    questions like "how many steps this week" without the AI needing raw
    database access.
    """
    daily = build_daily_context(db, user_id)
    weekly = build_weekly_context(db, user_id)

    recent_activity = activity_service.get_weekly_summary(db, user_id)

    return {
        "today": daily,
        "week": weekly,
        "last_7_days_steps": [{"date": d["date"], "steps": d["steps"]} for d in recent_activity],
    }
