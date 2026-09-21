from sqlalchemy import Column, Integer, Float, String, DateTime, Date, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base


class ActivityRecord(Base):
    __tablename__ = "activity_records"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    date = Column(DateTime, default=datetime.utcnow, index=True)
    steps = Column(Integer, default=0)
    distance_km = Column(Float, default=0.0)  # estimated
    active_minutes = Column(Integer, default=0)
    activity_type = Column(String, nullable=True)  # walking, running, cycling, etc.
    data_source = Column(String, default="mock")  # mock, mobile, android_health, ios_health, wearable, etc.

    # Set only for records written by the idempotent /api/activity/sync
    # endpoint (Phase 6). Manual/mock entries via POST /api/activity leave
    # this null and remain additive (multiple sessions per day sum, as in
    # Phase 2). A synced record instead represents one platform's current
    # cumulative daily total and is upserted in place on every sync — the
    # unique constraint below is what makes repeated syncs idempotent
    # rather than creating duplicate/summed rows.
    sync_day = Column(Date, nullable=True, index=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("user_id", "sync_day", "data_source", name="uq_activity_sync_per_user_day_source"),
    )

    # Relationship
    user = relationship("User", back_populates="activity_records")
