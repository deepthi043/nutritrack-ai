import os

os.environ["TESTING"] = "true"

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient

from app.database import Base
from app.database.session import get_db
from app.main import app

# Use an isolated in-memory SQLite database for tests so we never
# touch the real development/production PostgreSQL database.
# StaticPool keeps a single shared connection alive for the engine's
# lifetime — without it, each new connection gets its own blank
# in-memory database and tables created in one session are invisible
# to the next.
TEST_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture()
def db_session():
    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture()
def client(db_session):
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture()
def registered_user(client):
    """Register a user and return (client, auth_headers, user_json)."""
    response = client.post(
        "/api/auth/register",
        json={"email": "fixture@nutritrack.ai", "password": "FixturePass123", "full_name": "Fixture User"},
    )
    data = response.json()
    headers = {"Authorization": f"Bearer {data['access_token']}"}
    return headers, data["user"]
