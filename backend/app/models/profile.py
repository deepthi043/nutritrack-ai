from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base


class Profile(Base):
    __tablename__ = "profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, unique=True)
    age = Column(Integer, nullable=True)
    height_cm = Column(Float, nullable=True)
    weight_kg = Column(Float, nullable=True)
    activity_preference = Column(String, nullable=True)  # sedentary, light, moderate, active
    daily_step_goal = Column(Integer, default=10000)
    weekly_active_minutes_goal = Column(Integer, default=300)
    daily_water_goal_ml = Column(Integer, default=2500)  # milliliters
    # True once the user has explicitly set their own hydration goal via
    # PUT /api/goals (key="daily_water_ml") — from that point on, the
    # automatic weight-based recommendation (water_service.recommended_goal_ml)
    # is shown only as a suggestion alongside daily_water_goal_ml, and is
    # never applied to it automatically again. Before that, daily_water_goal_ml
    # tracks the auto-recommendation whenever weight_kg is available, so a
    # new user with weight already on their profile sees a sensible goal
    # without having to configure anything first.
    water_goal_manually_set = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationship
    user = relationship("User", back_populates="profile")
