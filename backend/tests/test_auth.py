def test_register_creates_user_and_returns_token(client):
    response = client.post(
        "/api/auth/register",
        json={"email": "newuser@nutritrack.ai", "password": "SecurePass123", "full_name": "New User"},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["access_token"]
    assert data["token_type"] == "bearer"
    assert data["user"]["email"] == "newuser@nutritrack.ai"
    assert data["user"]["full_name"] == "New User"
    assert "hashed_password" not in data["user"]


def test_register_duplicate_email_fails(client):
    payload = {"email": "dupe@nutritrack.ai", "password": "SecurePass123"}
    first = client.post("/api/auth/register", json=payload)
    assert first.status_code == 201

    second = client.post("/api/auth/register", json=payload)
    assert second.status_code == 400
    assert "already registered" in second.json()["detail"].lower()


def test_register_creates_default_profile(client):
    reg = client.post(
        "/api/auth/register",
        json={"email": "profileuser@nutritrack.ai", "password": "SecurePass123"},
    )
    headers = {"Authorization": f"Bearer {reg.json()['access_token']}"}

    profile_response = client.get("/api/profile", headers=headers)
    assert profile_response.status_code == 200
    profile = profile_response.json()
    assert profile["daily_step_goal"] == 10000
    assert profile["daily_water_goal_ml"] == 2500


def test_login_with_correct_credentials(client):
    client.post("/api/auth/register", json={"email": "login@nutritrack.ai", "password": "SecurePass123"})
    response = client.post("/api/auth/login", json={"email": "login@nutritrack.ai", "password": "SecurePass123"})
    assert response.status_code == 200
    assert response.json()["access_token"]


def test_login_with_wrong_password_fails(client):
    client.post("/api/auth/register", json={"email": "wrongpass@nutritrack.ai", "password": "SecurePass123"})
    response = client.post("/api/auth/login", json={"email": "wrongpass@nutritrack.ai", "password": "WrongPassword"})
    assert response.status_code == 401


def test_login_with_nonexistent_email_fails(client):
    response = client.post("/api/auth/login", json={"email": "ghost@nutritrack.ai", "password": "Whatever123"})
    assert response.status_code == 401


def test_me_endpoint_requires_authentication(client):
    response = client.get("/api/auth/me")
    assert response.status_code == 401


def test_me_endpoint_returns_current_user(client, registered_user):
    headers, user = registered_user
    response = client.get("/api/auth/me", headers=headers)
    assert response.status_code == 200
    assert response.json()["email"] == user["email"]


def test_me_endpoint_rejects_invalid_token(client):
    response = client.get("/api/auth/me", headers={"Authorization": "Bearer not-a-real-token"})
    assert response.status_code == 401


def test_logout_requires_authentication(client):
    response = client.post("/api/auth/logout")
    assert response.status_code == 401


def test_logout_succeeds_when_authenticated(client, registered_user):
    headers, _ = registered_user
    response = client.post("/api/auth/logout", headers=headers)
    assert response.status_code == 200
