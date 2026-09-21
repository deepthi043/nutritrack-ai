from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base


class AIInsight(Base):
    """A stored AI-generated insight (daily or weekly) for history/recall.

    `source` records which provider generated it ("mock" or "llm") so the
    UI can be transparent about how an older insight was produced even
    after the active provider changes.
    """

    __tablename__ = "ai_insights"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    insight_type = Column(String, nullable=False)  # "daily" | "weekly"
    generated_at = Column(DateTime, default=datetime.utcnow, index=True)
    content = Column(Text, nullable=False)
    source = Column(String, nullable=False, default="mock")  # mock | llm

    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationship
    user = relationship("User", back_populates="ai_insights")
