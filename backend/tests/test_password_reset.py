from app.models.password_reset_token import PasswordResetToken


def test_forgot_password_returns_generic_message_for_existing_user(client, registered_user):
    _, user = registered_user
    response = client.post("/api/auth/forgot-password", json={"email": user["email"]})
    assert response.status_code == 200
    assert "reset link has been sent" in response.json()["message"].lower()


def test_forgot_password_returns_same_generic_message_for_nonexistent_email(client):
    """Must not reveal whether an email is registered (account enumeration)."""
    response = client.post("/api/auth/forgot-password", json={"email": "doesnotexist@nutritrack.ai"})
    assert response.status_code == 200
    assert "reset link has been sent" in response.json()["message"].lower()


def test_forgot_password_dev_mode_returns_reset_link_for_existing_user(client, registered_user):
    """With no RESEND_API_KEY configured (test default), the link is
    returned directly so the flow is testable without email."""
    _, user = registered_user
    response = client.post("/api/auth/forgot-password", json={"email": user["email"]})
    data = response.json()
    assert data["dev_reset_link"] is not None
    assert "token=" in data["dev_reset_link"]


def test_forgot_password_dev_mode_omits_link_for_nonexistent_email(client):
    """No token is ever generated for an email that isn't registered, so
    there's nothing to leak even in dev mode."""
    response = client.post("/api/auth/forgot-password", json={"email": "doesnotexist@nutritrack.ai"})
    assert response.json()["dev_reset_link"] is None


def test_forgot_password_rejects_invalid_email_format(client):
    response = client.post("/api/auth/forgot-password", json={"email": "not-an-email"})
    assert response.status_code == 422


def _get_reset_token_for(db_session, email: str) -> str:
    from app.models.user import User

    user = db_session.query(User).filter(User.email == email).first()
    token_row = (
        db_session.query(PasswordResetToken)
        .filter(PasswordResetToken.user_id == user.id)
        .order_by(PasswordResetToken.id.desc())
        .first()
    )
    return token_row.token


def test_reset_password_with_valid_token_succeeds(client, registered_user, db_session):
    headers, user = registered_user
    client.post("/api/auth/forgot-password", json={"email": user["email"]})
    token = _get_reset_token_for(db_session, user["email"])

    response = client.post("/api/auth/reset-password", json={"token": token, "new_password": "BrandNewPass123"})
    assert response.status_code == 200

    # Old password no longer works
    old_login = client.post("/api/auth/login", json={"email": user["email"], "password": "FixturePass123"})
    assert old_login.status_code == 401

    # New password works
    new_login = client.post("/api/auth/login", json={"email": user["email"], "password": "BrandNewPass123"})
    assert new_login.status_code == 200


def test_reset_password_token_is_single_use(client, registered_user, db_session):
    headers, user = registered_user
    client.post("/api/auth/forgot-password", json={"email": user["email"]})
    token = _get_reset_token_for(db_session, user["email"])

    first = client.post("/api/auth/reset-password", json={"token": token, "new_password": "FirstNewPass123"})
    assert first.status_code == 200

    second = client.post("/api/auth/reset-password", json={"token": token, "new_password": "SecondNewPass123"})
    assert second.status_code == 400


def test_reset_password_rejects_invalid_token(client):
    response = client.post("/api/auth/reset-password", json={"token": "not-a-real-token", "new_password": "SomePass123"})
    assert response.status_code == 400


def test_reset_password_rejects_expired_token(client, registered_user, db_session):
    from datetime import datetime, timedelta

    headers, user = registered_user
    client.post("/api/auth/forgot-password", json={"email": user["email"]})
    token = _get_reset_token_for(db_session, user["email"])

    token_row = db_session.query(PasswordResetToken).filter(PasswordResetToken.token == token).first()
    token_row.expires_at = datetime.utcnow() - timedelta(minutes=1)
    db_session.commit()

    response = client.post("/api/auth/reset-password", json={"token": token, "new_password": "SomePass123"})
    assert response.status_code == 400


def test_reset_password_rejects_short_password(client, registered_user, db_session):
    headers, user = registered_user
    client.post("/api/auth/forgot-password", json={"email": user["email"]})
    token = _get_reset_token_for(db_session, user["email"])

    response = client.post("/api/auth/reset-password", json={"token": token, "new_password": "short"})
    assert response.status_code == 422


def test_reset_password_does_not_require_authentication(client, registered_user, db_session):
    """The whole point of this flow is to work when the user is logged out
    and has forgotten their password — it must not require a bearer token."""
    _, user = registered_user
    client.post("/api/auth/forgot-password", json={"email": user["email"]})
    token = _get_reset_token_for(db_session, user["email"])

    response = client.post("/api/auth/reset-password", json={"token": token, "new_password": "NoAuthNeeded123"})
    assert response.status_code == 200


def test_multiple_forgot_password_requests_each_get_own_token(client, registered_user, db_session):
    headers, user = registered_user
    client.post("/api/auth/forgot-password", json={"email": user["email"]})
    client.post("/api/auth/forgot-password", json={"email": user["email"]})

    tokens = (
        db_session.query(PasswordResetToken)
        .filter(PasswordResetToken.user_id == db_session.query(PasswordResetToken).first().user_id)
        .count()
    )
    assert tokens == 2
