def test_today_activity_requires_authentication(client):
    response = client.get("/api/activity/today")
    assert response.status_code == 401


def test_today_activity_empty_by_default(client, registered_user):
    headers, _ = registered_user
    response = client.get("/api/activity/today", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["steps"] == 0
    assert data["has_activity"] is False
    assert data["step_goal"] == 10000  # default profile goal


def test_add_activity_persists_and_appears_in_today(client, registered_user):
    headers, _ = registered_user
    response = client.post(
        "/api/activity",
        headers=headers,
        json={"steps": 7842, "distance_km": 5.3, "active_minutes": 62},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["steps"] == 7842
    assert data["distance_km"] == 5.3
    assert data["active_minutes"] == 62
    assert data["data_source"] == "mock"

    today = client.get("/api/activity/today", headers=headers).json()
    assert today["steps"] == 7842
    assert today["has_activity"] is True
    assert today["goal_progress_percent"] == 78.4


def test_add_activity_accumulates_multiple_entries_same_day(client, registered_user):
    headers, _ = registered_user
    client.post("/api/activity", headers=headers, json={"steps": 3000, "distance_km": 2.0, "active_minutes": 20})
    client.post("/api/activity", headers=headers, json={"steps": 2000, "distance_km": 1.5, "active_minutes": 15})

    today = client.get("/api/activity/today", headers=headers).json()
    assert today["steps"] == 5000
    assert today["distance_km"] == 3.5
    assert today["active_minutes"] == 35


def test_negative_steps_rejected(client, registered_user):
    headers, _ = registered_user
    response = client.post(
        "/api/activity",
        headers=headers,
        json={"steps": -100, "distance_km": 1.0, "active_minutes": 10},
    )
    assert response.status_code == 422


def test_negative_distance_rejected(client, registered_user):
    headers, _ = registered_user
    response = client.post(
        "/api/activity",
        headers=headers,
        json={"steps": 100, "distance_km": -5.0, "active_minutes": 10},
    )
    assert response.status_code == 422


def test_negative_active_minutes_rejected(client, registered_user):
    headers, _ = registered_user
    response = client.post(
        "/api/activity",
        headers=headers,
        json={"steps": 100, "distance_km": 1.0, "active_minutes": -20},
    )
    assert response.status_code == 422


def test_weekly_activity_returns_seven_zero_filled_days(client, registered_user):
    headers, _ = registered_user
    response = client.get("/api/activity/weekly", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 7
    assert all(point["steps"] == 0 for point in data)


def test_weekly_activity_includes_todays_entry(client, registered_user):
    headers, _ = registered_user
    client.post("/api/activity", headers=headers, json={"steps": 4321, "distance_km": 3.0, "active_minutes": 30})

    data = client.get("/api/activity/weekly", headers=headers).json()
    assert data[-1]["steps"] == 4321


def test_activity_history_returns_records(client, registered_user):
    headers, _ = registered_user
    client.post("/api/activity", headers=headers, json={"steps": 1000, "distance_km": 0.8, "active_minutes": 8})
    client.post("/api/activity", headers=headers, json={"steps": 2000, "distance_km": 1.5, "active_minutes": 15})

    response = client.get("/api/activity/history", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2


def test_user_cannot_see_another_users_activity(client):
    resp_a = client.post("/api/auth/register", json={"email": "activitya@nutritrack.ai", "password": "PassA12345"})
    headers_a = {"Authorization": f"Bearer {resp_a.json()['access_token']}"}
    client.post("/api/activity", headers=headers_a, json={"steps": 9999, "distance_km": 7.0, "active_minutes": 90})

    resp_b = client.post("/api/auth/register", json={"email": "activityb@nutritrack.ai", "password": "PassB12345"})
    headers_b = {"Authorization": f"Bearer {resp_b.json()['access_token']}"}

    today_b = client.get("/api/activity/today", headers=headers_b).json()
    assert today_b["steps"] == 0
    assert today_b["has_activity"] is False

    history_b = client.get("/api/activity/history", headers=headers_b).json()
    assert history_b == []


def test_cannot_inject_user_id_in_request_body(client, registered_user):
    """The user_id in the payload (if any) must be ignored; ownership always
    comes from the authenticated token."""
    headers, user = registered_user
    response = client.post(
        "/api/activity",
        headers=headers,
        json={"user_id": 99999, "steps": 500, "distance_km": 0.3, "active_minutes": 5},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["user_id"] == user["id"]
    assert data["user_id"] != 99999


def test_step_goal_progress_reflects_profile_goal(client, registered_user):
    headers, _ = registered_user
    client.put("/api/profile", headers=headers, json={"daily_step_goal": 5000})
    client.post("/api/activity", headers=headers, json={"steps": 2500, "distance_km": 2.0, "active_minutes": 25})

    today = client.get("/api/activity/today", headers=headers).json()
    assert today["step_goal"] == 5000
    assert today["goal_progress_percent"] == 50.0


def test_goal_progress_caps_at_100_percent(client, registered_user):
    headers, _ = registered_user
    client.put("/api/profile", headers=headers, json={"daily_step_goal": 1000})
    client.post("/api/activity", headers=headers, json={"steps": 5000, "distance_km": 4.0, "active_minutes": 40})

    today = client.get("/api/activity/today", headers=headers).json()
    assert today["goal_progress_percent"] == 100.0
