def test_history_requires_authentication(client):
    response = client.get("/api/history")
    assert response.status_code == 401


def test_history_defaults_to_last_7_days_zero_filled(client, registered_user):
    headers, _ = registered_user
    response = client.get("/api/history", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 7
    assert all(day["steps"] == 0 and day["water_ml"] == 0 for day in data)


def test_history_today_range(client, registered_user):
    headers, _ = registered_user
    response = client.get("/api/history?range=today", headers=headers)
    assert response.status_code == 200
    assert len(response.json()) == 1


def test_history_last_30_days_range(client, registered_user):
    headers, _ = registered_user
    response = client.get("/api/history?range=last_30_days", headers=headers)
    assert response.status_code == 200
    assert len(response.json()) == 30


def test_history_combines_activity_and_water_for_today(client, registered_user):
    headers, _ = registered_user
    client.post("/api/activity", headers=headers, json={"steps": 7842, "distance_km": 5.3, "active_minutes": 62})
    client.post("/api/water", headers=headers, json={"amount_ml": 1800})

    data = client.get("/api/history?range=today", headers=headers).json()
    today_entry = data[0]
    assert today_entry["steps"] == 7842
    assert today_entry["water_ml"] == 1800


def test_history_custom_date_range(client, registered_user):
    headers, _ = registered_user
    import datetime

    today = datetime.date.today().isoformat()
    response = client.get(f"/api/history?start_date={today}&end_date={today}", headers=headers)
    assert response.status_code == 200
    assert len(response.json()) == 1


def test_history_custom_range_requires_both_dates(client, registered_user):
    headers, _ = registered_user
    import datetime

    today = datetime.date.today().isoformat()
    response = client.get(f"/api/history?start_date={today}", headers=headers)
    assert response.status_code == 422


def test_history_rejects_start_after_end(client, registered_user):
    headers, _ = registered_user
    response = client.get("/api/history?start_date=2026-01-10&end_date=2026-01-01", headers=headers)
    assert response.status_code == 422


def test_history_is_newest_first(client, registered_user):
    headers, _ = registered_user
    response = client.get("/api/history?range=last_7_days", headers=headers)
    data = response.json()
    dates = [day["date"] for day in data]
    assert dates == sorted(dates, reverse=True)


def test_user_cannot_see_another_users_history(client, registered_user):
    headers_a, _ = registered_user
    client.post("/api/activity", headers=headers_a, json={"steps": 9999, "distance_km": 8.0, "active_minutes": 90})
    client.post("/api/water", headers=headers_a, json={"amount_ml": 3000})

    resp_b = client.post("/api/auth/register", json={"email": "historyb@nutritrack.ai", "password": "PassB12345"})
    headers_b = {"Authorization": f"Bearer {resp_b.json()['access_token']}"}

    data_b = client.get("/api/history?range=today", headers=headers_b).json()
    assert data_b[0]["steps"] == 0
    assert data_b[0]["water_ml"] == 0
