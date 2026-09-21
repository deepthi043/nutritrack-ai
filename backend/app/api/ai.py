from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.schemas.ai import (
    DailyInsightResponse,
    WeeklyInsightResponse,
    AIChatRequest,
    AIChatResponse,
    AIInsightHistoryItem,
)
from app.api.deps import get_current_user
from app.services import ai_service
from app.services.ai_safety import STANDARD_DISCLAIMER

router = APIRouter(prefix="/api/ai", tags=["ai"])


@router.post("/daily-insight", response_model=DailyInsightResponse)
def daily_insight(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Generate (and store) a fresh daily insight from the authenticated
    user's own logged activity and water data."""
    insight = ai_service.generate_daily_insight(db, current_user.id)
    return DailyInsightResponse(
        generated_at=insight.generated_at,
        content=insight.content,
        source=insight.source,
        disclaimer=STANDARD_DISCLAIMER,
    )


@router.post("/weekly-insight", response_model=WeeklyInsightResponse)
def weekly_insight(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Generate (and store) a fresh weekly analysis from the authenticated
    user's last 7 days of data."""
    insight = ai_service.generate_weekly_insight(db, current_user.id)
    return WeeklyInsightResponse(
        generated_at=insight.generated_at,
        content=insight.content,
        source=insight.source,
        disclaimer=STANDARD_DISCLAIMER,
    )


@router.post("/chat", response_model=AIChatResponse)
def chat(
    payload: AIChatRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Ask a data-aware question. Answers are grounded entirely in the
    authenticated user's own data — the AI never has access to another
    user's records."""
    answer, source = ai_service.answer_user_question(db, current_user.id, payload.question)
    return AIChatResponse(question=payload.question, answer=answer, source=source, disclaimer=STANDARD_DISCLAIMER)


@router.get("/insights/history", response_model=list[AIInsightHistoryItem])
def insight_history(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Previously generated daily/weekly insights, most recent first."""
    return ai_service.get_insight_history(db, current_user.id)
