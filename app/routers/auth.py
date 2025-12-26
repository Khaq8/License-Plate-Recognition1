"""
Authentication Router for License Plate Recognition System
Uses Supabase Auth for user management.
"""

from fastapi import APIRouter, Depends, status, HTTPException
from pydantic import BaseModel, EmailStr
from typing import Optional
from gotrue.errors import AuthApiError

from app.supabase_client import get_supabase, get_supabase_admin
from app.security import get_current_user, CurrentUser


router = APIRouter(prefix="/auth", tags=['Authentication'])


# ============== Request/Response Schemas ==============

class SignUpRequest(BaseModel):
    email: EmailStr
    password: str
    username: str
    full_name: Optional[str] = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int
    user: dict


class UserResponse(BaseModel):
    id: str
    email: Optional[str]
    username: Optional[str]
    full_name: Optional[str]
    is_admin: bool
    credit_balance: float
    created_at: Optional[str]


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class PasswordResetRequest(BaseModel):
    email: EmailStr


class PasswordUpdateRequest(BaseModel):
    new_password: str


# ============== Auth Endpoints ==============

@router.post("/signup", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def signup(request: SignUpRequest):
    """
    Register a new user account using Supabase Auth.
    Creates both an auth user and a profile record.
    """
    supabase = get_supabase()

    try:
        # Sign up with Supabase Auth
        auth_response = supabase.auth.sign_up({
            "email": request.email,
            "password": request.password,
            "options": {
                "data": {
                    "username": request.username,
                    "full_name": request.full_name
                }
            }
        })

        if not auth_response.user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to create user account"
            )

        # Check if email confirmation is required
        if not auth_response.session:
            return {
                "access_token": "",
                "refresh_token": "",
                "token_type": "bearer",
                "expires_in": 0,
                "user": {
                    "id": auth_response.user.id,
                    "email": auth_response.user.email,
                    "message": "Please check your email to confirm your account"
                }
            }

        return {
            "access_token": auth_response.session.access_token,
            "refresh_token": auth_response.session.refresh_token,
            "token_type": "bearer",
            "expires_in": auth_response.session.expires_in,
            "user": {
                "id": auth_response.user.id,
                "email": auth_response.user.email,
                "username": request.username
            }
        }

    except AuthApiError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Registration failed: {str(e)}"
        )


@router.post("/login", response_model=TokenResponse)
async def login(request: LoginRequest):
    """
    Authenticate user and return JWT tokens.
    """
    supabase = get_supabase()

    try:
        auth_response = supabase.auth.sign_in_with_password({
            "email": request.email,
            "password": request.password
        })

        if not auth_response.session:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid credentials"
            )

        # Fetch user profile
        supabase_admin = get_supabase_admin()
        profile = supabase_admin.table("profiles").select("*").eq(
            "id", auth_response.user.id
        ).single().execute()

        return {
            "access_token": auth_response.session.access_token,
            "refresh_token": auth_response.session.refresh_token,
            "token_type": "bearer",
            "expires_in": auth_response.session.expires_in,
            "user": {
                "id": auth_response.user.id,
                "email": auth_response.user.email,
                "username": profile.data.get("username") if profile.data else None,
                "is_admin": profile.data.get("is_admin", False) if profile.data else False
            }
        }

    except AuthApiError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Login failed: {str(e)}"
        )


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(request: RefreshTokenRequest):
    """
    Refresh the access token using a refresh token.
    """
    supabase = get_supabase()

    try:
        auth_response = supabase.auth.refresh_session(request.refresh_token)

        if not auth_response.session:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid refresh token"
            )

        return {
            "access_token": auth_response.session.access_token,
            "refresh_token": auth_response.session.refresh_token,
            "token_type": "bearer",
            "expires_in": auth_response.session.expires_in,
            "user": {
                "id": auth_response.user.id,
                "email": auth_response.user.email
            }
        }

    except AuthApiError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token"
        )


@router.post("/logout")
async def logout(current_user: CurrentUser = Depends(get_current_user)):
    """
    Sign out the current user.
    """
    supabase = get_supabase()

    try:
        supabase.auth.sign_out()
        return {"message": "Successfully logged out"}
    except Exception as e:
        # Even if sign out fails, we return success as the client should clear tokens
        return {"message": "Logged out"}


@router.get("/me", response_model=UserResponse)
async def get_current_user_profile(current_user: CurrentUser = Depends(get_current_user)):
    """
    Get the current authenticated user's profile.
    """
    return UserResponse(
        id=current_user.id,
        email=current_user.email,
        username=current_user.username,
        full_name=current_user.full_name,
        is_admin=current_user.is_admin,
        credit_balance=current_user.credit_balance,
        created_at=None  # Could fetch from profile if needed
    )


@router.post("/password/reset")
async def request_password_reset(request: PasswordResetRequest):
    """
    Request a password reset email.
    """
    supabase = get_supabase()

    try:
        supabase.auth.reset_password_email(request.email)
        return {"message": "If the email exists, a password reset link has been sent"}
    except Exception:
        # Always return success to prevent email enumeration
        return {"message": "If the email exists, a password reset link has been sent"}


@router.post("/password/update")
async def update_password(
    request: PasswordUpdateRequest,
    current_user: CurrentUser = Depends(get_current_user)
):
    """
    Update the current user's password.
    Requires authentication.
    """
    supabase = get_supabase()

    try:
        supabase.auth.update_user({"password": request.new_password})
        return {"message": "Password updated successfully"}
    except AuthApiError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


# ============== Legacy Endpoint (for backwards compatibility) ==============

@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register_legacy(request: SignUpRequest):
    """
    Legacy registration endpoint - redirects to signup.
    Kept for backwards compatibility with existing frontend.
    """
    result = await signup(request)

    # Return in the old format expected by the frontend
    return UserResponse(
        id=result["user"]["id"],
        email=result["user"].get("email"),
        username=result["user"].get("username"),
        full_name=request.full_name,
        is_admin=False,
        credit_balance=0.0,
        created_at=None
    )
