def test_add_water_requires_authentication(client):
    response = client.post("/api/water", json={"amount_ml": 500})
    assert response.status_code == 401


def test_today_water_empty_by_default(client, registered_user):
    headers, _ = registered_user
    response = client.get("/api/water/today", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["total_ml"] == 0
    assert data["goal_ml"] == 2500
    assert data["progress_percent"] == 0.0


def test_add_water_persists_and_appears_in_today(client, registered_user):
    headers, _ = registered_user
    response = client.post("/api/water", headers=headers, json={"amount_ml": 500})
    assert response.status_code == 201
    data = response.json()
    assert data["amount_ml"] == 500

    today = client.get("/api/water/today", headers=headers).json()
    assert today["total_ml"] == 500
    assert today["progress_percent"] == 20.0


def test_add_water_accumulates_multiple_entries(client, registered_user):
    headers, _ = registered_user
    client.post("/api/water", headers=headers, json={"amount_ml": 250})
    client.post("/api/water", headers=headers, json={"amount_ml": 500})
    client.post("/api/water", headers=headers, json={"amount_ml": 750})

    today = client.get("/api/water/today", headers=headers).json()
    assert today["total_ml"] == 1500


def test_water_progress_caps_at_100_but_total_is_not_truncated(client, registered_user):
    headers, _ = registered_user
    client.put("/api/goals", headers=headers, json={"key": "daily_water_ml", "target": 2500})
    client.post("/api/water", headers=headers, json={"amount_ml": 3000})

    today = client.get("/api/water/today", headers=headers).json()
    assert today["progress_percent"] == 100.0
    assert today["total_ml"] == 3000  # real total retained, not capped


def test_negative_water_amount_rejected(client, registered_user):
    headers, _ = registered_user
    response = client.post("/api/water", headers=headers, json={"amount_ml": -100})
    assert response.status_code == 422


def test_zero_water_amount_rejected(client, registered_user):
    headers, _ = registered_user
    response = client.post("/api/water", headers=headers, json={"amount_ml": 0})
    assert response.status_code == 422


def test_unreasonably_large_water_amount_rejected(client, registered_user):
    headers, _ = registered_user
    response = client.post("/api/water", headers=headers, json={"amount_ml": 999999})
    assert response.status_code == 422


def test_water_history_returns_records(client, registered_user):
    headers, _ = registered_user
    client.post("/api/water", headers=headers, json={"amount_ml": 250})
    client.post("/api/water", headers=headers, json={"amount_ml": 500})

    response = client.get("/api/water/history", headers=headers)
    assert response.status_code == 200
    assert len(response.json()) == 2


def test_water_history_empty_for_new_user(client, registered_user):
    headers, _ = registered_user
    response = client.get("/api/water/history", headers=headers)
    assert response.status_code == 200
    assert response.json() == []


def test_weekly_water_returns_seven_zero_filled_days(client, registered_user):
    headers, _ = registered_user
    response = client.get("/api/water/weekly", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 7
    assert all(point["amount_ml"] == 0 for point in data)


def test_weekly_water_includes_todays_entry(client, registered_user):
    headers, _ = registered_user
    client.post("/api/water", headers=headers, json={"amount_ml": 750})

    data = client.get("/api/water/weekly", headers=headers).json()
    assert data[-1]["amount_ml"] == 750


def test_delete_water_entry(client, registered_user):
    headers, _ = registered_user
    created = client.post("/api/water", headers=headers, json={"amount_ml": 500}).json()

    response = client.delete(f"/api/water/{created['id']}", headers=headers)
    assert response.status_code == 204

    today = client.get("/api/water/today", headers=headers).json()
    assert today["total_ml"] == 0


def test_delete_nonexistent_water_entry_returns_404(client, registered_user):
    headers, _ = registered_user
    response = client.delete("/api/water/99999", headers=headers)
    assert response.status_code == 404


def test_user_cannot_see_another_users_water(client, registered_user):
    headers_a, _ = registered_user
    client.post("/api/water", headers=headers_a, json={"amount_ml": 1000})

    resp_b = client.post("/api/auth/register", json={"email": "waterb@nutritrack.ai", "password": "PassB12345"})
    headers_b = {"Authorization": f"Bearer {resp_b.json()['access_token']}"}

    today_b = client.get("/api/water/today", headers=headers_b).json()
    assert today_b["total_ml"] == 0

    history_b = client.get("/api/water/history", headers=headers_b).json()
    assert history_b == []


def test_user_cannot_delete_another_users_water_entry(client, registered_user):
    headers_a, _ = registered_user
    entry_a = client.post("/api/water", headers=headers_a, json={"amount_ml": 500}).json()

    resp_b = client.post("/api/auth/register", json={"email": "waterb2@nutritrack.ai", "password": "PassB12345"})
    headers_b = {"Authorization": f"Bearer {resp_b.json()['access_token']}"}

    response = client.delete(f"/api/water/{entry_a['id']}", headers=headers_b)
    assert response.status_code == 404

    # Confirm it still exists for the owner
    today_a = client.get("/api/water/today", headers=headers_a).json()
    assert today_a["total_ml"] == 500


def test_cannot_inject_user_id_into_water_payload(client, registered_user):
    headers, user = registered_user
    response = client.post("/api/water", headers=headers, json={"user_id": 99999, "amount_ml": 500})
    assert response.status_code == 201
    assert response.json()["user_id"] == user["id"]
