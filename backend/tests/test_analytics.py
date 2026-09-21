def test_analytics_summary_requires_authentication(client):
    response = client.get("/api/analytics/summary")
    assert response.status_code == 401


def test_activity_analytics_empty_when_no_data(client, registered_user):
    headers, _ = registered_user
    response = client.get("/api/analytics/activity", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["average_daily_steps"] == 0.0
    assert data["total_weekly_steps"] == 0
    assert data["best_day_date"] is None
    assert data["goal_completion_percent"] == 0.0


def test_activity_analytics_computes_average_and_total(client, registered_user):
    headers, _ = registered_user
    client.post("/api/activity", headers=headers, json={"steps": 8000, "distance_km": 6.0, "active_minutes": 60})

    data = client.get("/api/analytics/activity", headers=headers).json()
    assert data["total_weekly_steps"] == 8000
    assert data["average_daily_steps"] == round(8000 / 7, 1)
    assert data["best_day_steps"] == 8000
    assert data["average_active_minutes"] == round(60 / 7, 1)


def test_activity_goal_completion_uses_profile_goal(client, registered_user):
    headers, _ = registered_user
    client.put("/api/profile", headers=headers, json={"daily_step_goal": 8000})
    client.post("/api/activity", headers=headers, json={"steps": 8000, "distance_km": 6.0, "active_minutes": 60})

    data = client.get("/api/analytics/activity", headers=headers).json()
    # 100% for the one tracked day, averaged over 7 days = 100/7
    assert data["goal_completion_percent"] == round(100 / 7, 1)


def test_water_analytics_empty_when_no_data(client, registered_user):
    headers, _ = registered_user
    response = client.get("/api/analytics/water", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["average_daily_ml"] == 0.0
    assert data["best_day_date"] is None
    assert data["days_goal_reached"] == 0


def test_water_analytics_computes_best_day_and_goal_reached(client, registered_user):
    headers, _ = registered_user
    client.put("/api/goals", headers=headers, json={"key": "daily_water_ml", "target": 2000})
    client.post("/api/water", headers=headers, json={"amount_ml": 2500})

    data = client.get("/api/analytics/water", headers=headers).json()
    assert data["best_day_ml"] == 2500
    assert data["days_goal_reached"] == 1
    assert data["average_goal_completion_percent"] == round(100 / 7, 1)


def test_analytics_summary_includes_consistency_score(client, registered_user):
    headers, _ = registered_user
    response = client.get("/api/analytics/summary", headers=headers)
    data = response.json()
    assert "activity" in data
    assert "water" in data
    assert "consistency" in data
    assert "score_percent" in data["consistency"]
    assert "components" in data["consistency"]
    assert set(data["consistency"]["components"].keys()) == {"activity", "water"}


def test_consistency_score_is_average_of_components(client, registered_user):
    headers, _ = registered_user
    client.put("/api/profile", headers=headers, json={"daily_step_goal": 1000})
    client.post("/api/activity", headers=headers, json={"steps": 1000, "distance_km": 1.0, "active_minutes": 10})
    client.put("/api/goals", headers=headers, json={"key": "daily_water_ml", "target": 1000})
    client.post("/api/water", headers=headers, json={"amount_ml": 1000})

    data = client.get("/api/analytics/summary", headers=headers).json()
    components = data["consistency"]["components"]
    expected_score = round(sum(components.values()) / len(components), 1)
    assert data["consistency"]["score_percent"] == expected_score


def test_user_cannot_see_another_users_analytics(client, registered_user):
    headers_a, _ = registered_user
    client.post("/api/activity", headers=headers_a, json={"steps": 9999, "distance_km": 8.0, "active_minutes": 90})
    client.post("/api/water", headers=headers_a, json={"amount_ml": 3000})

    resp_b = client.post("/api/auth/register", json={"email": "analyticsb@nutritrack.ai", "password": "PassB12345"})
    headers_b = {"Authorization": f"Bearer {resp_b.json()['access_token']}"}

    activity_b = client.get("/api/analytics/activity", headers=headers_b).json()
    assert activity_b["total_weekly_steps"] == 0

    water_b = client.get("/api/analytics/water", headers=headers_b).json()
    assert water_b["average_daily_ml"] == 0.0


def test_weekly_alias_matches_summary(client, registered_user):
    headers, _ = registered_user
    summary = client.get("/api/analytics/summary", headers=headers).json()
    weekly = client.get("/api/analytics/weekly", headers=headers).json()
    assert summary == weekly
