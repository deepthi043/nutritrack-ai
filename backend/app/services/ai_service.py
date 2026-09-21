"""AIService — the single entry point the API layer calls for AI features.

Pipeline (per the Phase 5 architecture):

    Authenticated user
        -> user data services (activity/water/goal/analytics)
        -> ai_context_builder (structured context, no raw DB access beyond here)
        -> AIProvider (mock or llm)
        -> ai_safety (blocks medical/diagnostic/dangerous content)
        -> persisted to ai_insights (for daily/weekly insights)
        -> returned to the API/UI

The AI provider never receives a database session or a user id — only the
plain context dict — so it structurally cannot access another user's data
or query the database directly.
"""

from datetime import datetime

from sqlalchemy.orm import Session

from app.models.ai_insight import AIInsight
from app.services import ai_context_builder, ai_safety
from app.services.ai_provider import get_ai_provider


def generate_daily_insight(db: Session, user_id: int) -> AIInsight:
    context = ai_context_builder.build_daily_context(db, user_id)
    provider = get_ai_provider()

    raw_content = provider.generate_daily_insight(context)
    safe_content = ai_safety.sanitize_response(raw_content)

    insight = AIInsight(
        user_id=user_id,
        insight_type="daily",
        generated_at=datetime.utcnow(),
        content=safe_content,
        source=provider.get_source_name(),
    )
    db.add(insight)
    db.commit()
    db.refresh(insight)
    return insight


def generate_weekly_insight(db: Session, user_id: int) -> AIInsight:
    context = ai_context_builder.build_weekly_context(db, user_id)
    provider = get_ai_provider()

    raw_content = provider.generate_weekly_insight(context)
    safe_content = ai_safety.sanitize_response(raw_content)

    insight = AIInsight(
        user_id=user_id,
        insight_type="weekly",
        generated_at=datetime.utcnow(),
        content=safe_content,
        source=provider.get_source_name(),
    )
    db.add(insight)
    db.commit()
    db.refresh(insight)
    return insight


def answer_user_question(db: Session, user_id: int, question: str) -> tuple[str, str]:
    """Returns (answer, source). Not persisted to ai_insights — chat
    exchanges are conversational, not durable "insights" — but nothing
    prevents adding chat history later without touching this signature.
    """
    context = ai_context_builder.build_chat_context(db, user_id)
    provider = get_ai_provider()

    raw_answer = provider.answer_question(question, context)
    safe_answer = ai_safety.sanitize_response(raw_answer)
    return safe_answer, provider.get_source_name()


def get_insight_history(db: Session, user_id: int, limit: int = 20) -> list[AIInsight]:
    return (
        db.query(AIInsight)
        .filter(AIInsight.user_id == user_id)
        .order_by(AIInsight.generated_at.desc())
        .limit(limit)
        .all()
    )
