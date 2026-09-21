import datetime


def _today_str():
    return datetime.date.today().isoformat()


def test_sync_requires_authentication(client):
    response = client.post(
        "/api/activity/sync",
        json={"date": _today_str(), "steps": 5000, "distance_km": 3.5, "active_minutes": 40, "source": "android_health"},
    )
    assert response.status_code == 401


def test_first_sync_creates_a_record(client, registered_user):
    headers, _ = registered_user
    response = client.post(
        "/api/activity/sync",
        headers=headers,
        json={"date": _today_str(), "steps": 5000, "distance_km": 3.5, "active_minutes": 40, "source": "android_health"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["steps"] == 5000
    assert data["source"] == "android_health"
    assert data["was_updated"] is False

    today = client.get("/api/activity/today", headers=headers).json()
    assert today["steps"] == 5000


def test_repeated_sync_with_same_total_does_not_duplicate(client, registered_user):
    """Section 15: syncing 7,842 steps twice must not show 15,684."""
    headers, _ = registered_user
    payload = {"date": _today_str(), "steps": 7842, "distance_km": 5.3, "active_minutes": 62, "source": "android_health"}

    client.post("/api/activity/sync", headers=headers, json=payload)
    client.post("/api/activity/sync", headers=headers, json=payload)
    client.post("/api/activity/sync", headers=headers, json=payload)

    today = client.get("/api/activity/today", headers=headers).json()
    assert today["steps"] == 7842

    history = client.get("/api/activity/history", headers=headers).json()
    assert len(history) == 1


def test_repeated_sync_with_increasing_total_updates_in_place(client, registered_user):
    """Section 10/23: 7000 -> 7500 -> 7842 across the day must end at 7842,
    not 7000+7500+7842."""
    headers, _ = registered_user
    date = _today_str()

    r1 = client.post(
        "/api/activity/sync",
        headers=headers,
        json={"date": date, "steps": 7000, "distance_km": 5.0, "active_minutes": 55, "source": "android_health"},
    )
    assert r1.json()["was_updated"] is False

    r2 = client.post(
        "/api/activity/sync",
        headers=headers,
        json={"date": date, "steps": 7500, "distance_km": 5.1, "active_minutes": 58, "source": "android_health"},
    )
    assert r2.json()["was_updated"] is True

    r3 = client.post(
        "/api/activity/sync",
        headers=headers,
        json={"date": date, "steps": 7842, "distance_km": 5.3, "active_minutes": 62, "source": "android_health"},
    )
    assert r3.json()["was_updated"] is True

    today = client.get("/api/activity/today", headers=headers).json()
    assert today["steps"] == 7842
    assert today["distance_km"] == 5.3
    assert today["active_minutes"] == 62

    history = client.get("/api/activity/history", headers=headers).json()
    assert len(history) == 1  # still one row, updated in place


def test_sync_and_manual_entry_are_independent_and_both_count(client, registered_user):
    """Manual/mock entries (POST /api/activity) stay additive; sync stays
    idempotent. Both contribute to the same daily total."""
    headers, _ = registered_user

    client.post("/api/activity", headers=headers, json={"steps": 500, "distance_km": 0.4, "active_minutes": 5})
    client.post(
        "/api/activity/sync",
        headers=headers,
        json={"date": _today_str(), "steps": 7842, "distance_km": 5.3, "active_minutes": 62, "source": "android_health"},
    )

    today = client.get("/api/activity/today", headers=headers).json()
    assert today["steps"] == 8342  # 500 manual + 7842 synced

    # Sync again with the same total — manual entry must be untouched, no duplication
    client.post(
        "/api/activity/sync",
        headers=headers,
        json={"date": _today_str(), "steps": 7842, "distance_km": 5.3, "active_minutes": 62, "source": "android_health"},
    )
    today = client.get("/api/activity/today", headers=headers).json()
    assert today["steps"] == 8342


def test_different_sources_sync_independently_for_same_day(client, registered_user):
    """A phone (android_health) and a separate wearable sync for the same
    day must be tracked as two distinct records, both counted."""
    headers, _ = registered_user
    date = _today_str()

    client.post(
        "/api/activity/sync",
        headers=headers,
        json={"date": date, "steps": 4000, "distance_km": 3.0, "active_minutes": 30, "source": "android_health"},
    )
    client.post(
        "/api/activity/sync",
        headers=headers,
        json={"date": date, "steps": 4200, "distance_km": 3.1, "active_minutes": 32, "source": "wearable"},
    )

    today = client.get("/api/activity/today", headers=headers).json()
    assert today["steps"] == 8200

    history = client.get("/api/activity/history", headers=headers).json()
    assert len(history) == 2


def test_sync_negative_steps_rejected(client, registered_user):
    headers, _ = registered_user
    response = client.post(
        "/api/activity/sync",
        headers=headers,
        json={"date": _today_str(), "steps": -100, "distance_km": 1.0, "active_minutes": 10, "source": "android_health"},
    )
    assert response.status_code == 422


def test_sync_invalid_source_rejected(client, registered_user):
    headers, _ = registered_user
    response = client.post(
        "/api/activity/sync",
        headers=headers,
        json={"date": _today_str(), "steps": 100, "distance_km": 1.0, "active_minutes": 10, "source": "fitbit_v2"},
    )
    assert response.status_code == 422


def test_sync_appears_in_weekly_summary(client, registered_user):
    headers, _ = registered_user
    client.post(
        "/api/activity/sync",
        headers=headers,
        json={"date": _today_str(), "steps": 6000, "distance_km": 4.5, "active_minutes": 45, "source": "ios_health"},
    )

    weekly = client.get("/api/activity/weekly", headers=headers).json()
    assert weekly[-1]["steps"] == 6000


def test_cannot_inject_user_id_via_sync(client, registered_user):
    headers, user = registered_user
    response = client.post(
        "/api/activity/sync",
        headers=headers,
        json={
            "date": _today_str(),
            "steps": 100,
            "distance_km": 0.1,
            "active_minutes": 1,
            "source": "android_health",
            "user_id": 99999,
        },
    )
    assert response.status_code == 200
    # Confirm it landed on the authenticated user, not the injected id
    today = client.get("/api/activity/today", headers=headers).json()
    assert today["steps"] == 100


def test_user_cannot_see_another_users_synced_activity(client, registered_user):
    headers_a, _ = registered_user
    client.post(
        "/api/activity/sync",
        headers=headers_a,
        json={"date": _today_str(), "steps": 9999, "distance_km": 8.0, "active_minutes": 90, "source": "android_health"},
    )

    resp_b = client.post("/api/auth/register", json={"email": "syncuserb@nutritrack.ai", "password": "PassB12345"})
    headers_b = {"Authorization": f"Bearer {resp_b.json()['access_token']}"}

    today_b = client.get("/api/activity/today", headers=headers_b).json()
    assert today_b["steps"] == 0


def test_android_native_is_a_valid_sync_source(client, registered_user):
    """Phase 6.1: the phone's own hardware step-sensor provider syncs under
    source='android_native', independent of (and without requiring) Health
    Connect."""
    headers, _ = registered_user
    response = client.post(
        "/api/activity/sync",
        headers=headers,
        json={"date": _today_str(), "steps": 3500, "distance_km": 2.7, "active_minutes": 28, "source": "android_native"},
    )
    assert response.status_code == 200
    assert response.json()["source"] == "android_native"

    today = client.get("/api/activity/today", headers=headers).json()
    assert today["steps"] == 3500


def test_android_native_and_android_health_sync_independently(client, registered_user):
    """If a device somehow has both providers active (e.g. during a
    migration), each source's cumulative total stays independent — the
    native sensor is never silently overwritten by Health Connect data or
    vice versa."""
    headers, _ = registered_user
    date = _today_str()

    client.post(
        "/api/activity/sync",
        headers=headers,
        json={"date": date, "steps": 3500, "distance_km": 2.7, "active_minutes": 28, "source": "android_native"},
    )
    client.post(
        "/api/activity/sync",
        headers=headers,
        json={"date": date, "steps": 4000, "distance_km": 3.0, "active_minutes": 30, "source": "android_health"},
    )

    today = client.get("/api/activity/today", headers=headers).json()
    assert today["steps"] == 7500  # both sources counted, neither overwritten

    history = client.get("/api/activity/history", headers=headers).json()
    assert len(history) == 2


def test_sync_zero_steps_is_a_valid_reading(client, registered_user):
    """A device genuinely reporting 0 steps so far today (e.g. right after
    midnight, or before the user has moved) must be accepted and reflected
    honestly — not rejected, not treated as "no data"."""
    headers, _ = registered_user
    response = client.post(
        "/api/activity/sync",
        headers=headers,
        json={"date": _today_str(), "steps": 0, "distance_km": 0.0, "active_minutes": 0, "source": "android_health"},
    )
    assert response.status_code == 200
    assert response.json()["steps"] == 0

    today = client.get("/api/activity/today", headers=headers).json()
    assert today["steps"] == 0
    assert today["has_activity"] is True  # a real synced record exists, even though its total is 0


def test_today_uses_client_local_date_when_provided(client, registered_user):
    """Section 8: the server's own UTC 'today' can differ from the mobile
    device's local calendar day. A client-supplied local_date must be
    honored so a correctly-synced reading is never silently excluded from
    'today' purely due to timezone offset."""
    headers, _ = registered_user
    tomorrow = (datetime.date.today() + datetime.timedelta(days=1)).isoformat()

    # Simulates a device in a timezone ahead of UTC where local "today" is
    # already the day after the server's UTC "today".
    client.post(
        "/api/activity/sync",
        headers=headers,
        json={"date": tomorrow, "steps": 6100, "distance_km": 4.2, "active_minutes": 40, "source": "android_health"},
    )

    # Without local_date, the server's own UTC-today query must not find it.
    today_utc = client.get("/api/activity/today", headers=headers).json()
    assert today_utc["steps"] == 0

    # With local_date matching what the device actually synced, it must.
    today_local = client.get("/api/activity/today", headers=headers, params={"local_date": tomorrow}).json()
    assert today_local["steps"] == 6100
    assert today_local["date"] == tomorrow


def test_weekly_uses_client_local_date_when_provided(client, registered_user):
    headers, _ = registered_user
    tomorrow = (datetime.date.today() + datetime.timedelta(days=1)).isoformat()

    client.post(
        "/api/activity/sync",
        headers=headers,
        json={"date": tomorrow, "steps": 6100, "distance_km": 4.2, "active_minutes": 40, "source": "android_health"},
    )

    weekly_local = client.get("/api/activity/weekly", headers=headers, params={"local_date": tomorrow}).json()
    assert weekly_local[-1]["date"] == tomorrow
    assert weekly_local[-1]["steps"] == 6100


def test_sync_for_past_date_does_not_affect_today(client, registered_user):
    headers, _ = registered_user
    yesterday = (datetime.date.today() - datetime.timedelta(days=1)).isoformat()

    client.post(
        "/api/activity/sync",
        headers=headers,
        json={"date": yesterday, "steps": 3000, "distance_km": 2.0, "active_minutes": 20, "source": "android_health"},
    )

    today = client.get("/api/activity/today", headers=headers).json()
    assert today["steps"] == 0

    weekly = client.get("/api/activity/weekly", headers=headers).json()
    assert weekly[-2]["steps"] == 3000  # yesterday, second-to-last in a 7-day oldest-first list
