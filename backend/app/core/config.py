from pydantic_settings import BaseSettings
from functools import lru_cache
from typing import Optional


class Settings(BaseSettings):
    # Application
    app_name: str = "NutriTrack AI"
    app_version: str = "0.1.0"
    debug: bool = False
    testing: bool = False

    # Database
    database_url: str = "postgresql://nutritrack:nutritrack@localhost/nutritrack_db"

    # JWT
    secret_key: str = "your-secret-key-change-this-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30

    # CORS
    cors_origins: list = ["http://localhost:5173", "http://localhost:3000"]

    # AI service (server-side only — never exposed to frontend).
    # ai_provider selects the backing implementation: "mock" (default, no
    # external calls, always available) or "llm" (requires ai_api_key).
    # If ai_provider="llm" but ai_api_key is empty, the service falls back
    # to mock automatically rather than failing — see ai_provider.py.
    ai_provider: str = "mock"
    ai_api_key: Optional[str] = None
    ai_model: str = "claude-sonnet-5"

    # Email (password reset). If resend_api_key is empty, the app never
    # fails — it logs the reset link server-side instead of emailing it,
    # so the flow is fully testable with zero configuration. See
    # app/services/email_service.py.
    resend_api_key: Optional[str] = None
    resend_from_email: str = "NutriTrack AI <onboarding@resend.dev>"
    frontend_url: str = "http://localhost:5190"

    class Config:
        env_file = ".env"
        case_sensitive = False

    @property
    def DATABASE_URL(self) -> str:
        return self.database_url


@lru_cache()
def get_settings():
    return Settings()


settings = get_settings()
