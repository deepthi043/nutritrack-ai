from app.services.water_service import calculate_recommended_goal_ml, ML_PER_KG, MIN_RECOMMENDED_ML, MAX_RECOMMENDED_ML


def test_calculate_recommended_goal_matches_spec_example():
    """Part 13's exact worked example: 60kg x 35ml/kg = 2100ml."""
    assert calculate_recommended_goal_ml(60) == 2100


def test_calculate_recommended_goal_returns_none_without_weight():
    assert calculate_recommended_goal_ml(None) is None
    assert calculate_recommended_goal_ml(0) is None
    assert calculate_recommended_goal_ml(-5) is None


def test_calculate_recommended_goal_is_clamped_to_sane_bounds():
    assert calculate_recommended_goal_ml(1) == MIN_RECOMMENDED_ML
    assert calculate_recommended_goal_ml(1000) == MAX_RECOMMENDED_ML


def test_ml_per_kg_is_the_documented_constant():
    assert ML_PER_KG == 35


def test_today_water_uses_default_goal_when_weight_is_unset(client, registered_user):
    """Part 13: 'If weight is unavailable: use the existing configured
    water goal' — no weight means no auto-recommendation is applied."""
    headers, _ = registered_user
    data = client.get("/api/water/today", headers=headers).json()
    assert data["goal_ml"] == 2500
    assert data["recommended_goal_ml"] is None
    assert data["is_using_recommended_goal"] is False


def test_today_water_goal_automatically_follows_weight_when_not_customized(client, registered_user):
    headers, _ = registered_user
    client.put("/api/profile", headers=headers, json={"weight_kg": 60})

    data = client.get("/api/water/today", headers=headers).json()
    assert data["goal_ml"] == 2100
    assert data["recommended_goal_ml"] == 2100
    assert data["is_using_recommended_goal"] is True


def test_setting_a_custom_goal_stops_automatic_updates(client, registered_user):
    """Part 13: 'Allow the user to change/customize the goal' — once set,
    the auto-recommendation must never silently overwrite it again."""
    headers, _ = registered_user
    client.put("/api/profile", headers=headers, json={"weight_kg": 60})
    client.put("/api/goals", headers=headers, json={"key": "daily_water_ml", "target": 3000})

    # Weight-based recommendation would be 2100, but the user chose 3000.
    data = client.get("/api/water/today", headers=headers).json()
    assert data["goal_ml"] == 3000
    assert data["recommended_goal_ml"] == 2100  # still shown as a suggestion
    assert data["is_using_recommended_goal"] is False

    # Changing weight again must not silently override the custom goal.
    client.put("/api/profile", headers=headers, json={"weight_kg": 80})
    data_after = client.get("/api/water/today", headers=headers).json()
    assert data_after["goal_ml"] == 3000
    assert data_after["recommended_goal_ml"] == 2800


def test_recommendation_updates_as_weight_changes_when_not_customized(client, registered_user):
    headers, _ = registered_user
    client.put("/api/profile", headers=headers, json={"weight_kg": 50})
    first = client.get("/api/water/today", headers=headers).json()
    assert first["goal_ml"] == 1750

    client.put("/api/profile", headers=headers, json={"weight_kg": 90})
    second = client.get("/api/water/today", headers=headers).json()
    assert second["goal_ml"] == 3150


def test_recommendation_is_never_presented_as_a_medical_prescription(client, registered_user):
    """No behavioral assertion possible for wording in a JSON API — this
    documents the constraint at the test level: the response contains
    only numeric goal data, no diagnostic or prescriptive text field."""
    headers, _ = registered_user
    client.put("/api/profile", headers=headers, json={"weight_kg": 60})
    data = client.get("/api/water/today", headers=headers).json()
    assert set(data.keys()) == {
        "date",
        "total_ml",
        "goal_ml",
        "progress_percent",
        "recommended_goal_ml",
        "is_using_recommended_goal",
    }
