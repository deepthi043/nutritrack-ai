import datetime


def _iso(days_ago: int) -> str:
    return (datetime.date.today() - datetime.timedelta(days=days_ago)).isoformat()


def _log_steps(client, headers, days_ago: int, steps: int):
    date = _iso(days_ago)
    client.post(
        "/api/activity/sync",
        headers=headers,
        json={"date": date, "steps": steps, "distance_km": steps * 0.0007, "active_minutes": steps // 100, "source": "android_native"},
    )


def _log_water(client, headers, days_ago: int, amount_ml: int):
    consumed_at = f"{_iso(days_ago)}T12:00:00"
    client.post("/api/water", headers=headers, json={"amount_ml": amount_ml, "consumed_at": consumed_at})


def test_streaks_requires_authentication(client):
    response = client.get("/api/streaks")
    assert response.status_code == 401


def test_no_activity_yields_zero_streaks(client, registered_user):
    headers, _ = registered_user
    response = client.get("/api/streaks", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data == {
        "overall": {"current": 0, "best": 0},
        "steps": {"current": 0, "best": 0},
        "hydration": {"current": 0, "best": 0},
    }


def test_single_successful_day_gives_current_streak_of_one(client, registered_user):
    """Part 19: default goal is 10,000 steps."""
    headers, _ = registered_user
    _log_steps(client, headers, days_ago=0, steps=12000)

    data = client.get("/api/streaks", headers=headers).json()
    assert data["steps"] == {"current": 1, "best": 1}


def test_three_consecutive_successful_days(client, registered_user):
    """Matches the spec's exact example: today, yesterday, 2 days ago all
    complete -> current streak = 3."""
    headers, _ = registered_user
    _log_steps(client, headers, days_ago=2, steps=11000)
    _log_steps(client, headers, days_ago=1, steps=10500)
    _log_steps(client, headers, days_ago=0, steps=10000)

    data = client.get("/api/streaks", headers=headers).json()
    assert data["steps"]["current"] == 3
    assert data["steps"]["best"] == 3


def test_missed_day_breaks_the_streak(client, registered_user):
    """Goal met 3 days ago and today, but missed yesterday -> current
    streak only counts today (1), not the 3-day-ago day too (not
    consecutive)."""
    headers, _ = registered_user
    _log_steps(client, headers, days_ago=3, steps=11000)
    _log_steps(client, headers, days_ago=2, steps=11000)
    _log_steps(client, headers, days_ago=1, steps=3000)  # missed
    _log_steps(client, headers, days_ago=0, steps=10500)

    data = client.get("/api/streaks", headers=headers).json()
    assert data["steps"]["current"] == 1  # only today
    assert data["steps"]["best"] == 2  # the earlier 2-day run


def test_today_incomplete_does_not_zero_out_yesterdays_streak(client, registered_user):
    """Part 22: 'today incomplete' must not erase an in-progress streak —
    the streak is based on the last fully-known qualifying day."""
    headers, _ = registered_user
    _log_steps(client, headers, days_ago=2, steps=10500)
    _log_steps(client, headers, days_ago=1, steps=10200)
    _log_steps(client, headers, days_ago=0, steps=500)  # today, not done yet

    data = client.get("/api/streaks", headers=headers).json()
    assert data["steps"]["current"] == 2  # yesterday + the day before


def test_current_streak_is_zero_when_yesterday_and_today_both_missed(client, registered_user):
    headers, _ = registered_user
    _log_steps(client, headers, days_ago=5, steps=11000)
    _log_steps(client, headers, days_ago=1, steps=1000)  # missed
    _log_steps(client, headers, days_ago=0, steps=500)  # missed (today)

    data = client.get("/api/streaks", headers=headers).json()
    assert data["steps"]["current"] == 0
    assert data["steps"]["best"] == 1


def test_hydration_streak_uses_daily_water_goal(client, registered_user):
    """Part 20: default hydration goal is 2500ml."""
    headers, _ = registered_user
    _log_water(client, headers, days_ago=1, amount_ml=2600)
    _log_water(client, headers, days_ago=0, amount_ml=2500)

    data = client.get("/api/streaks", headers=headers).json()
    assert data["hydration"]["current"] == 2
    assert data["hydration"]["best"] == 2


def test_hydration_streak_breaks_on_a_short_day(client, registered_user):
    headers, _ = registered_user
    _log_water(client, headers, days_ago=2, amount_ml=2600)
    _log_water(client, headers, days_ago=1, amount_ml=1800)  # short
    _log_water(client, headers, days_ago=0, amount_ml=2500)

    data = client.get("/api/streaks", headers=headers).json()
    assert data["hydration"]["current"] == 1
    assert data["hydration"]["best"] == 1


def test_overall_streak_requires_both_step_and_hydration_goals_met(client, registered_user):
    """Part 21: overall = step goal AND hydration goal both met."""
    headers, _ = registered_user
    # Day -1: both met
    _log_steps(client, headers, days_ago=1, steps=11000)
    _log_water(client, headers, days_ago=1, amount_ml=2600)
    # Day 0 (today): only steps met, hydration short
    _log_steps(client, headers, days_ago=0, steps=10500)
    _log_water(client, headers, days_ago=0, amount_ml=500)

    data = client.get("/api/streaks", headers=headers).json()
    assert data["steps"]["current"] == 2  # both days
    assert data["hydration"]["current"] == 1  # only day -1
    assert data["overall"]["current"] == 1  # only day -1 satisfies both


def test_overall_streak_full_example(client, registered_user):
    headers, _ = registered_user
    for days_ago in (2, 1, 0):
        _log_steps(client, headers, days_ago=days_ago, steps=10500)
        _log_water(client, headers, days_ago=days_ago, amount_ml=2600)

    data = client.get("/api/streaks", headers=headers).json()
    assert data["overall"] == {"current": 3, "best": 3}


def test_streaks_use_client_local_date_when_provided(client, registered_user):
    """Part 22: streaks must respect the client's local calendar day, not
    blindly server UTC, matching GET /api/activity/today's own pattern."""
    headers, _ = registered_user
    tomorrow = (datetime.date.today() + datetime.timedelta(days=1)).isoformat()

    client.post(
        "/api/activity/sync",
        headers=headers,
        json={"date": tomorrow, "steps": 11000, "distance_km": 8.0, "active_minutes": 90, "source": "android_native"},
    )

    without_local_date = client.get("/api/streaks", headers=headers).json()
    assert without_local_date["steps"]["current"] == 0  # server's own UTC "today" doesn't see it

    with_local_date = client.get("/api/streaks", headers=headers, params={"local_date": tomorrow}).json()
    assert with_local_date["steps"]["current"] == 1


def test_user_isolation_streaks_are_not_shared(client, registered_user):
    headers_a, _ = registered_user
    _log_steps(client, headers_a, days_ago=0, steps=12000)

    resp_b = client.post("/api/auth/register", json={"email": "streakuserb@nutritrack.ai", "password": "PassB12345"})
    headers_b = {"Authorization": f"Bearer {resp_b.json()['access_token']}"}

    data_b = client.get("/api/streaks", headers=headers_b).json()
    assert data_b["steps"]["current"] == 0


def test_streak_history_reflects_actual_daily_completion(client, registered_user):
    headers, _ = registered_user
    _log_steps(client, headers, days_ago=2, steps=11000)
    _log_water(client, headers, days_ago=2, amount_ml=2600)
    _log_steps(client, headers, days_ago=1, steps=1000)  # missed
    _log_steps(client, headers, days_ago=0, steps=10500)
    _log_water(client, headers, days_ago=0, amount_ml=2600)

    history = client.get("/api/streaks/history", headers=headers, params={"days": 3}).json()
    assert len(history) == 3
    assert history[0]["step_goal_met"] is True
    assert history[0]["hydration_goal_met"] is True
    assert history[0]["overall_goal_met"] is True
    assert history[1]["step_goal_met"] is False
    assert history[2]["step_goal_met"] is True
    assert history[2]["hydration_goal_met"] is True


def test_streak_history_requires_authentication(client):
    response = client.get("/api/streaks/history")
    assert response.status_code == 401


def test_custom_step_goal_affects_streak_qualification(client, registered_user):
    """Streaks must use the user's actual configured goal, not a hardcoded
    default."""
    headers, _ = registered_user
    client.put("/api/goals", headers=headers, json={"key": "daily_steps", "target": 5000})
    _log_steps(client, headers, days_ago=0, steps=6000)

    data = client.get("/api/streaks", headers=headers).json()
    assert data["steps"]["current"] == 1
