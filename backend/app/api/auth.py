from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.models.profile import Profile
from app.models.password_reset_token import PasswordResetToken
from app.schemas.auth import (
    UserRegister,
    UserLogin,
    TokenResponse,
    ForgotPasswordRequest,
    ForgotPasswordResponse,
    ResetPasswordRequest,
)
from app.schemas.user import UserResponse
from app.core.security import get_password_hash, verify_password, create_access_token
from app.core.config import settings
from app.api.deps import get_current_user
from app.services import email_service

router = APIRouter(prefix="/api/auth", tags=["auth"])

GENERIC_FORGOT_PASSWORD_MESSAGE = (
    "If an account exists for that email, a password reset link has been sent."
)


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register(payload: UserRegister, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")

    user = User(
        email=payload.email,
        hashed_password=get_password_hash(payload.password),
        full_name=payload.full_name,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # Create an empty profile shell so onboarding has something to update
    profile = Profile(user_id=user.id)
    db.add(profile)
    db.commit()

    token = create_access_token(
        data={"sub": str(user.id)},
        expires_delta=timedelta(minutes=settings.access_token_expire_minutes),
    )

    return TokenResponse(
        access_token=token,
        user=UserResponse.model_validate(user).model_dump(mode="json"),
    )


@router.post("/login", response_model=TokenResponse)
def login(payload: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Inactive user")

    token = create_access_token(
        data={"sub": str(user.id)},
        expires_delta=timedelta(minutes=settings.access_token_expire_minutes),
    )

    return TokenResponse(
        access_token=token,
        user=UserResponse.model_validate(user).model_dump(mode="json"),
    )


@router.post("/logout")
def logout(current_user: User = Depends(get_current_user)):
    # JWTs are stateless; logout is handled client-side by discarding the token.
    # This endpoint exists for API symmetry and future token-blocklist support.
    return {"message": "Logged out successfully"}


@router.get("/me", response_model=UserResponse)
def read_current_user(current_user: User = Depends(get_current_user)):
    return current_user


@router.post("/forgot-password", response_model=ForgotPasswordResponse)
def forgot_password(payload: ForgotPasswordRequest, db: Session = Depends(get_db)):
    """Request a password reset link.

    Always returns the same generic message regardless of whether the email
    is registered — this prevents an attacker from using this endpoint to
    discover which email addresses have accounts (account enumeration).
    """
    user = db.query(User).filter(User.email == payload.email).first()

    if user:
        reset_token = PasswordResetToken(
            user_id=user.id,
            token=PasswordResetToken.generate_token(),
            expires_at=PasswordResetToken.default_expiry(),
        )
        db.add(reset_token)
        db.commit()

        reset_link = f"{settings.frontend_url}/reset-password?token={reset_token.token}"
        was_emailed = email_service.send_password_reset_email(user.email, reset_link)

        # Dev-mode fallback: if no email provider is configured, hand the
        # link back in the response so the flow is testable end-to-end
        # without external setup. This branch never runs once a real
        # RESEND_API_KEY is set — was_emailed is only False in dev mode or
        # on a delivery failure. We check is_configured() specifically
        # (not just was_emailed) so a transient send failure with a real
        # key configured does NOT leak the link into the API response.
        if not was_emailed and not email_service.is_configured():
            return ForgotPasswordResponse(message=GENERIC_FORGOT_PASSWORD_MESSAGE, dev_reset_link=reset_link)

    return ForgotPasswordResponse(message=GENERIC_FORGOT_PASSWORD_MESSAGE)


@router.post("/reset-password")
def reset_password(payload: ResetPasswordRequest, db: Session = Depends(get_db)):
    reset_token = db.query(PasswordResetToken).filter(PasswordResetToken.token == payload.token).first()

    if reset_token is None or not reset_token.is_valid():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired reset link")

    user = db.query(User).filter(User.id == reset_token.user_id).first()
    if user is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired reset link")

    user.hashed_password = get_password_hash(payload.new_password)
    reset_token.used = True
    db.commit()

    return {"message": "Password has been reset successfully. You can now log in with your new password."}
