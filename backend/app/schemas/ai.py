from pydantic import BaseModel, Field
from datetime import datetime
from typing import Literal, Optional


class DailyInsightResponse(BaseModel):
    insight_type: Literal["daily"] = "daily"
    generated_at: datetime
    content: str
    source: str  # "mock" | "llm"
    disclaimer: str


class WeeklyInsightResponse(BaseModel):
    insight_type: Literal["weekly"] = "weekly"
    generated_at: datetime
    content: str
    source: str
    disclaimer: str


class AIChatRequest(BaseModel):
    question: str = Field(min_length=1, max_length=1000)


class AIChatResponse(BaseModel):
    question: str
    answer: str
    source: str
    disclaimer: str


class AIInsightHistoryItem(BaseModel):
    id: int
    insight_type: str
    generated_at: datetime
    content: str
    source: str

    class Config:
        from_attributes = True
