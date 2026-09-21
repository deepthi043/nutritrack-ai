def test_get_goals_requires_authentication(client):
    response = client.get("/api/goals")
    assert response.status_code == 401


def test_get_goals_returns_all_defined_goals_with_defaults(client, registered_user):
    headers, _ = registered_user
    response = client.get("/api/goals", headers=headers)
    assert response.status_code == 200
    data = response.json()
    keys = {g["key"] for g in data}
    assert keys == {
        "daily_steps",
        "weekly_active_minutes",
        "daily_water_ml",
    }

    steps_goal = next(g for g in data if g["key"] == "daily_steps")
    assert steps_goal["target"] == 10000
    assert steps_goal["current"] == 0
    assert steps_goal["progress_percent"] == 0.0
    assert steps_goal["category"] == "activity"


def test_goal_progress_reflects_real_activity_data(client, registered_user):
    headers, _ = registered_user
    client.post("/api/activity", headers=headers, json={"steps": 5000, "distance_km": 4.0, "active_minutes": 40})

    data = client.get("/api/goals", headers=headers).json()
    steps_goal = next(g for g in data if g["key"] == "daily_steps")
    assert steps_goal["current"] == 5000
    assert steps_goal["progress_percent"] == 50.0


def test_goal_progress_reflects_real_water_data(client, registered_user):
    headers, _ = registered_user
    client.post("/api/water", headers=headers, json={"amount_ml": 1250})

    data = client.get("/api/goals", headers=headers).json()
    water_goal = next(g for g in data if g["key"] == "daily_water_ml")
    assert water_goal["current"] == 1250
    assert water_goal["progress_percent"] == 50.0


def test_update_goal_persists(client, registered_user):
    headers, _ = registered_user
    response = client.put("/api/goals", headers=headers, json={"key": "daily_steps", "target": 12000})
    assert response.status_code == 200
    assert response.json()["target"] == 12000

    data = client.get("/api/goals", headers=headers).json()
    steps_goal = next(g for g in data if g["key"] == "daily_steps")
    assert steps_goal["target"] == 12000


def test_update_weekly_active_minutes_goal(client, registered_user):
    headers, _ = registered_user
    response = client.put("/api/goals", headers=headers, json={"key": "weekly_active_minutes", "target": 200})
    assert response.status_code == 200
    assert response.json()["target"] == 200


def test_update_goal_rejects_zero_or_negative_target(client, registered_user):
    headers, _ = registered_user
    response = client.put("/api/goals", headers=headers, json={"key": "daily_steps", "target": 0})
    assert response.status_code == 422

    response = client.put("/api/goals", headers=headers, json={"key": "daily_steps", "target": -500})
    assert response.status_code == 422


def test_update_goal_rejects_invalid_key(client, registered_user):
    headers, _ = registered_user
    response = client.put("/api/goals", headers=headers, json={"key": "not_a_real_goal", "target": 100})
    assert response.status_code == 422


def test_existing_step_goal_from_profile_still_works(client, registered_user):
    """Phase 2's step-goal-via-profile mechanism must continue working
    unchanged after the unified goals API is added."""
    headers, _ = registered_user
    client.put("/api/profile", headers=headers, json={"daily_step_goal": 15000})

    data = client.get("/api/goals", headers=headers).json()
    steps_goal = next(g for g in data if g["key"] == "daily_steps")
    assert steps_goal["target"] == 15000

    activity_today = client.get("/api/activity/today", headers=headers).json()
    assert activity_today["step_goal"] == 15000


def test_user_cannot_see_another_users_goal_progress(client, registered_user):
    headers_a, _ = registered_user
    client.post("/api/activity", headers=headers_a, json={"steps": 9000, "distance_km": 7.0, "active_minutes": 80})

    resp_b = client.post("/api/auth/register", json={"email": "goalsb@nutritrack.ai", "password": "PassB12345"})
    headers_b = {"Authorization": f"Bearer {resp_b.json()['access_token']}"}

    data_b = client.get("/api/goals", headers=headers_b).json()
    steps_goal_b = next(g for g in data_b if g["key"] == "daily_steps")
    assert steps_goal_b["current"] == 0


def test_user_cannot_update_another_users_goal(client, registered_user):
    headers_a, _ = registered_user
    client.put("/api/goals", headers=headers_a, json={"key": "daily_steps", "target": 20000})

    resp_b = client.post("/api/auth/register", json={"email": "goalsb2@nutritrack.ai", "password": "PassB12345"})
    headers_b = {"Authorization": f"Bearer {resp_b.json()['access_token']}"}
    client.put("/api/goals", headers=headers_b, json={"key": "daily_steps", "target": 5000})

    data_a = client.get("/api/goals", headers=headers_a).json()
    steps_goal_a = next(g for g in data_a if g["key"] == "daily_steps")
    assert steps_goal_a["target"] == 20000  # unaffected by user B's update
