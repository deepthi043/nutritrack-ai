def test_daily_insight_requires_authentication(client):
    response = client.post("/api/ai/daily-insight")
    assert response.status_code == 401


def test_daily_insight_works_with_no_data_logged(client, registered_user):
    """AI must never crash or refuse just because a user hasn't logged
    anything yet — it should acknowledge that honestly."""
    headers, _ = registered_user
    response = client.post("/api/ai/daily-insight", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["source"] == "mock"
    assert "disclaimer" in data
    assert len(data["content"]) > 0


def test_daily_insight_reflects_real_logged_data(client, registered_user):
    headers, _ = registered_user
    client.post("/api/activity", headers=headers, json={"steps": 8500, "distance_km": 6.2, "active_minutes": 65})
    client.post("/api/water", headers=headers, json={"amount_ml": 1500})

    response = client.post("/api/ai/daily-insight", headers=headers)
    data = response.json()
    assert "8,500" in data["content"] or "8500" in data["content"]


def test_daily_insight_never_fabricates_unlogged_data(client, registered_user):
    """A user with zero activity/water logged must never see fabricated
    numbers in their insight."""
    headers, _ = registered_user
    response = client.post("/api/ai/daily-insight", headers=headers)
    data = response.json()
    assert "no activity" in data["content"].lower() or "no water" in data["content"].lower()


def test_daily_insight_is_persisted_to_history(client, registered_user):
    headers, _ = registered_user
    client.post("/api/ai/daily-insight", headers=headers)

    history = client.get("/api/ai/insights/history", headers=headers).json()
    assert len(history) == 1
    assert history[0]["insight_type"] == "daily"


def test_weekly_insight_requires_authentication(client):
    response = client.post("/api/ai/weekly-insight")
    assert response.status_code == 401


def test_weekly_insight_works_with_no_data(client, registered_user):
    headers, _ = registered_user
    response = client.post("/api/ai/weekly-insight", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["source"] == "mock"
    assert len(data["content"]) > 0


def test_weekly_insight_reflects_real_analytics_data(client, registered_user):
    headers, _ = registered_user
    client.put("/api/profile", headers=headers, json={"daily_step_goal": 8000})
    client.post("/api/activity", headers=headers, json={"steps": 8000, "distance_km": 6.0, "active_minutes": 60})

    response = client.post("/api/ai/weekly-insight", headers=headers)
    data = response.json()
    assert "consistency score" in data["content"].lower()


def test_weekly_insight_is_persisted_to_history(client, registered_user):
    headers, _ = registered_user
    client.post("/api/ai/weekly-insight", headers=headers)

    history = client.get("/api/ai/insights/history", headers=headers).json()
    assert len(history) == 1
    assert history[0]["insight_type"] == "weekly"


def test_insight_history_orders_newest_first(client, registered_user):
    headers, _ = registered_user
    client.post("/api/ai/daily-insight", headers=headers)
    client.post("/api/ai/weekly-insight", headers=headers)

    history = client.get("/api/ai/insights/history", headers=headers).json()
    assert len(history) == 2
    assert history[0]["insight_type"] == "weekly"  # generated second, so newest


def test_chat_requires_authentication(client):
    response = client.post("/api/ai/chat", json={"question": "How many steps today?"})
    assert response.status_code == 401


def test_chat_answers_step_question_with_real_data(client, registered_user):
    headers, _ = registered_user
    client.post("/api/activity", headers=headers, json={"steps": 7842, "distance_km": 5.3, "active_minutes": 62})

    response = client.post("/api/ai/chat", headers=headers, json={"question": "How many steps did I take today?"})
    assert response.status_code == 200
    data = response.json()
    assert "7,842" in data["answer"] or "7842" in data["answer"]


def test_chat_answers_water_question(client, registered_user):
    headers, _ = registered_user
    client.post("/api/water", headers=headers, json={"amount_ml": 1800})

    response = client.post("/api/ai/chat", headers=headers, json={"question": "How much water have I had today?"})
    data = response.json()
    assert "1.8" in data["answer"]


def test_chat_handles_unrecognized_question_gracefully(client, registered_user):
    headers, _ = registered_user
    response = client.post("/api/ai/chat", headers=headers, json={"question": "What is the meaning of life?"})
    assert response.status_code == 200
    data = response.json()
    assert len(data["answer"]) > 0


def test_chat_rejects_empty_question(client, registered_user):
    headers, _ = registered_user
    response = client.post("/api/ai/chat", headers=headers, json={"question": ""})
    assert response.status_code == 422


def test_chat_does_not_persist_to_insight_history(client, registered_user):
    """Chat exchanges are conversational, not durable insights."""
    headers, _ = registered_user
    client.post("/api/ai/chat", headers=headers, json={"question": "How many steps today?"})

    history = client.get("/api/ai/insights/history", headers=headers).json()
    assert history == []


# --- Safety ---


def test_all_responses_include_disclaimer(client, registered_user):
    headers, _ = registered_user
    daily = client.post("/api/ai/daily-insight", headers=headers).json()
    weekly = client.post("/api/ai/weekly-insight", headers=headers).json()
    chat = client.post("/api/ai/chat", headers=headers, json={"question": "How am I doing?"}).json()

    assert "healthcare professional" in daily["disclaimer"].lower()
    assert "healthcare professional" in weekly["disclaimer"].lower()
    assert "healthcare professional" in chat["disclaimer"].lower()


def test_ai_safety_blocks_diagnostic_language():
    from app.services.ai_safety import is_content_safe

    assert is_content_safe("You have diabetes based on your sugar intake.") is False
    assert is_content_safe("This is a symptom of a metabolic disorder.") is False
    assert is_content_safe("You are diabetic given these numbers.") is False


def test_ai_safety_blocks_cure_claims():
    from app.services.ai_safety import is_content_safe

    assert is_content_safe("Eating more fiber cures diabetes.") is False


def test_ai_safety_blocks_dangerous_calorie_prescriptions():
    from app.services.ai_safety import is_content_safe

    assert is_content_safe("You should eat under 800 calories a day.") is False


def test_ai_safety_blocks_replacing_doctor_claims():
    from app.services.ai_safety import is_content_safe

    assert is_content_safe("You don't need to see a doctor for this.") is False


def test_ai_safety_allows_normal_wellness_language():
    from app.services.ai_safety import is_content_safe

    assert is_content_safe("You've logged 5000 steps today, which is 50% of your goal.") is True
    assert is_content_safe("Your fiber intake looks low — consider more whole grains.") is True


def test_sanitize_response_appends_disclaimer_when_missing():
    from app.services.ai_safety import sanitize_response, STANDARD_DISCLAIMER

    result = sanitize_response("You logged 5000 steps today.")
    assert STANDARD_DISCLAIMER in result


def test_sanitize_response_replaces_unsafe_content():
    from app.services.ai_safety import sanitize_response, SAFE_FALLBACK_MESSAGE

    result = sanitize_response("You have diabetes.")
    assert result == SAFE_FALLBACK_MESSAGE


# --- Cross-user isolation ---


def test_user_cannot_see_another_users_insight_history(client, registered_user):
    headers_a, _ = registered_user
    client.post("/api/ai/daily-insight", headers=headers_a)

    resp_b = client.post("/api/auth/register", json={"email": "aiuserb@nutritrack.ai", "password": "PassB12345"})
    headers_b = {"Authorization": f"Bearer {resp_b.json()['access_token']}"}

    history_b = client.get("/api/ai/insights/history", headers=headers_b).json()
    assert history_b == []


def test_ai_context_never_leaks_another_users_data(client, registered_user):
    headers_a, _ = registered_user
    client.post("/api/activity", headers=headers_a, json={"steps": 99999, "distance_km": 50.0, "active_minutes": 300})

    resp_b = client.post("/api/auth/register", json={"email": "aiuserb2@nutritrack.ai", "password": "PassB12345"})
    headers_b = {"Authorization": f"Bearer {resp_b.json()['access_token']}"}

    response_b = client.post("/api/ai/chat", headers=headers_b, json={"question": "How many steps today?"})
    assert "99,999" not in response_b.json()["answer"]
    assert "99999" not in response_b.json()["answer"]


# --- Provider fallback ---


def test_get_ai_provider_falls_back_to_mock_without_api_key(monkeypatch):
    from app.services.ai_provider import get_ai_provider, MockAIProvider
    from app.core.config import settings

    monkeypatch.setattr(settings, "ai_provider", "llm")
    monkeypatch.setattr(settings, "ai_api_key", None)

    provider = get_ai_provider()
    assert isinstance(provider, MockAIProvider)


def test_get_ai_provider_uses_mock_by_default(monkeypatch):
    from app.services.ai_provider import get_ai_provider, MockAIProvider
    from app.core.config import settings

    monkeypatch.setattr(settings, "ai_provider", "mock")

    provider = get_ai_provider()
    assert isinstance(provider, MockAIProvider)
