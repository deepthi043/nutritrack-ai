from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.database import Base
from app.database.session import engine
from app import models  # noqa: F401 - ensures all models are registered with Base
from app.api import auth, profile, activity, water, goals, analytics, history, ai, streaks


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create tables if they do not already exist. For production schema
    # evolution, replace with Alembic migrations.
    # Skipped under pytest: tests override get_db with an isolated SQLite
    # engine and create their own schema in conftest.py fixtures.
    if not settings.testing:
        Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="NutriTrack AI — personal wellness and activity tracker API",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {"name": settings.app_name, "version": settings.app_version, "status": "ok"}


@app.get("/health")
def health_check():
    return {"status": "healthy"}


app.include_router(auth.router)
app.include_router(profile.router)
app.include_router(activity.router)
app.include_router(water.router)
app.include_router(goals.router)
app.include_router(analytics.router)
app.include_router(history.router)
app.include_router(ai.router)
app.include_router(streaks.router)
