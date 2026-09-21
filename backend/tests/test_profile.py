def test_get_profile_requires_authentication(client):
    response = client.get("/api/profile")
    assert response.status_code == 401


def test_update_profile_persists_changes(client, registered_user):
    headers, _ = registered_user
    response = client.put(
        "/api/profile",
        headers=headers,
        json={"age": 30, "height_cm": 175.0, "weight_kg": 70.0, "daily_step_goal": 12000},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["age"] == 30
    assert data["height_cm"] == 175.0
    assert data["daily_step_goal"] == 12000

    # Confirm the change persisted on a fresh GET
    refetched = client.get("/api/profile", headers=headers)
    assert refetched.json()["age"] == 30


def test_user_cannot_access_another_users_profile(client):
    # Register user A and set a distinctive age
    resp_a = client.post("/api/auth/register", json={"email": "usera@nutritrack.ai", "password": "PassA12345"})
    headers_a = {"Authorization": f"Bearer {resp_a.json()['access_token']}"}
    client.put("/api/profile", headers=headers_a, json={"age": 99})

    # Register user B and confirm their profile is independent
    resp_b = client.post("/api/auth/register", json={"email": "userb@nutritrack.ai", "password": "PassB12345"})
    headers_b = {"Authorization": f"Bearer {resp_b.json()['access_token']}"}

    profile_b = client.get("/api/profile", headers=headers_b).json()
    assert profile_b["age"] != 99
    assert profile_b["user_id"] != resp_a.json()["user"]["id"]
