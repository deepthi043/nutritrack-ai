"""Transactional email sending via Resend (https://resend.com).

If RESEND_API_KEY is not configured, this module never raises or blocks
the calling flow — it logs the would-be email (including the reset link)
to the server console instead. This mirrors the same "safe fallback"
pattern used by the mock AI/activity providers elsewhere in this app: the
password-reset flow is fully functional and testable with zero external
configuration, and a real API key can be dropped into .env later with no
code changes.

Never put RESEND_API_KEY in frontend code or send it to the client.
"""

import logging

import httpx

from app.core.config import settings

logger = logging.getLogger("nutritrack.email")

RESEND_API_URL = "https://api.resend.com/emails"


def is_configured() -> bool:
    return bool(settings.resend_api_key)


def send_password_reset_email(to_email: str, reset_link: str) -> bool:
    """Send the password reset email. Returns True if an email was actually
    sent via Resend, False if it fell back to logging (dev mode / no key).

    Never raises — a failed send should not break the forgot-password
    endpoint's response to the user (which must stay identical whether or
    not the email address exists, to avoid leaking account existence).
    """
    subject = "Reset your NutriTrack AI password"
    html_body = (
        f"<p>We received a request to reset your NutriTrack AI password.</p>"
        f'<p><a href="{reset_link}">Click here to reset your password</a></p>'
        f"<p>This link expires in 30 minutes. If you didn't request this, you can safely ignore this email.</p>"
    )

    if not is_configured():
        logger.info(
            "RESEND_API_KEY not configured — password reset email not sent. "
            "Dev-mode reset link for %s: %s",
            to_email,
            reset_link,
        )
        return False

    try:
        response = httpx.post(
            RESEND_API_URL,
            headers={"Authorization": f"Bearer {settings.resend_api_key}"},
            json={
                "from": settings.resend_from_email,
                "to": [to_email],
                "subject": subject,
                "html": html_body,
            },
            timeout=10.0,
        )
        response.raise_for_status()
        return True
    except httpx.HTTPError:
        logger.exception("Failed to send password reset email to %s via Resend", to_email)
        return False
