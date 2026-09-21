import secrets
from sqlalchemy import Column, Integer, String, DateTime, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime, timedelta
from app.database import Base

RESET_TOKEN_TTL_MINUTES = 30


class PasswordResetToken(Base):
    """A single-use, time-limited token for the forgot-password flow.

    The raw token is emailed to the user and never stored anywhere except
    this row — only this row is looked up on redemption, so there is
    nothing else in the system that could leak it. `used` prevents replay
    even within the expiry window.
    """

    __tablename__ = "password_reset_tokens"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    token = Column(String, nullable=False, unique=True, index=True)
    expires_at = Column(DateTime, nullable=False)
    used = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User")

    @staticmethod
    def generate_token() -> str:
        return secrets.token_urlsafe(32)

    @staticmethod
    def default_expiry() -> datetime:
        return datetime.utcnow() + timedelta(minutes=RESET_TOKEN_TTL_MINUTES)

    def is_valid(self) -> bool:
        return not self.used and self.expires_at > datetime.utcnow()
