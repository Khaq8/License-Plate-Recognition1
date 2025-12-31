"""
Authentication Router for License Plate Recognition System
Uses Supabase Auth for user management.

Environment variables required (from .env):
- SUPABASE_URL
- SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY
- SUPABASE_JWT_SECRET (optional)
"""

import logging
from fastapi import APIRouter, Depends, status, HTTPException
from pydantic import BaseModel, EmailStr
from typing import Optional
from gotrue.errors import AuthApiError

from app.supabase_client import get_supabase, get_supabase_admin
from app.security import get_current_user, CurrentUser
from app.config import settings

# Set up logging
logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.DEBUG)


router = APIRouter(prefix="/auth", tags=['Authentication'])


# ============== Request/Response Schemas ==============

class SignUpRequest(BaseModel):
    email: EmailStr
    password: str
    username: str
    first_name: str
    last_name: str


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
    first_name: Optional[str]
    last_name: Optional[str]
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
    logger.info("=== SIGNUP ENDPOINT CALLED ===")
    logger.info(f"Request email: {request.email}")
    logger.info(f"Request username: {request.username}")
    logger.info(f"Request first_name: {request.first_name}")
    logger.info(f"Request last_name: {request.last_name}")
    logger.info(f"Password length: {len(request.password)}")
    logger.info(f"Supabase URL configured: {settings.supabase_url[:30]}...")

    supabase = get_supabase()
    supabase_admin = get_supabase_admin()
    logger.info("Got Supabase clients")

    # Check if username already exists
    existing_username = supabase_admin.table("profiles").select("id").eq(
        "username", request.username
    ).execute()
    if existing_username.data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already taken"
        )

    # Check if email already exists
    existing_email = supabase_admin.table("profiles").select("id").eq(
        "email", request.email
    ).execute()
    if existing_email.data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )

    try:
        # Sign up with Supabase Auth
        logger.info("Calling supabase.auth.sign_up...")
        auth_response = supabase.auth.sign_up({
            "email": request.email,
            "password": request.password,
            "options": {
                "data": {
                    "username": request.username,
                    "first_name": request.first_name,
                    "last_name": request.last_name
                }
            }
        })
        logger.info("Supabase sign_up response received")
        logger.info(f"auth_response.user: {auth_response.user}")
        logger.info(f"auth_response.session: {auth_response.session}")

        if not auth_response.user:
            logger.error("No user in auth_response")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to create user account"
            )

        user_id = auth_response.user.id
        logger.info(f"User created with ID: {user_id}")

        # Create or update profile record in the profiles table
        # Using upsert in case a Supabase trigger already created the profile
        logger.info("Creating/updating profile record...")
        profile_data = {
            "id": user_id,
            "username": request.username,
            "email": request.email,
            "first_name": request.first_name,
            "last_name": request.last_name,
            "is_admin": False,
            "credit_balance": 0.00
        }

        profile_result = supabase_admin.table("profiles").upsert(
            profile_data,
            on_conflict="id"
        ).execute()

        if not profile_result.data:
            logger.error("Failed to create/update profile record")
            # Try to clean up the auth user if profile creation fails
            try:
                supabase_admin.auth.admin.delete_user(user_id)
            except Exception as cleanup_error:
                logger.error(f"Failed to cleanup auth user: {cleanup_error}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create user profile"
            )

        logger.info(f"Profile upserted successfully: {profile_result.data}")

        # Check if email confirmation is required
        if not auth_response.session:
            logger.info("No session - email confirmation may be required")
            return {
                "access_token": "",
                "refresh_token": "",
                "token_type": "bearer",
                "expires_in": 0,
                "user": {
                    "id": user_id,
                    "email": auth_response.user.email,
                    "username": request.username,
                    "message": "Please check your email to confirm your account"
                }
            }

        logger.info("Session created, returning tokens")
        return {
            "access_token": auth_response.session.access_token,
            "refresh_token": auth_response.session.refresh_token,
            "token_type": "bearer",
            "expires_in": auth_response.session.expires_in,
            "user": {
                "id": user_id,
                "email": auth_response.user.email,
                "username": request.username,
                "first_name": request.first_name,
                "last_name": request.last_name,
                "is_admin": False,
                "credit_balance": 0.0
            }
        }

    except AuthApiError as e:
        logger.error(f"AuthApiError: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error: {type(e).__name__}: {str(e)}")
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")
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
        first_name=current_user.first_name,
        last_name=current_user.last_name,
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
    logger.info("=== REGISTER (LEGACY) ENDPOINT CALLED ===")
    logger.info(f"Request: email={request.email}, username={request.username}")
    logger.info(f"first_name={request.first_name}, last_name={request.last_name}")

    try:
        result = await signup(request)
        logger.info(f"Signup result: {result}")

        # Return in the old format expected by the frontend
        response = UserResponse(
            id=result["user"]["id"],
            email=result["user"].get("email"),
            username=result["user"].get("username"),
            first_name=request.first_name,
            last_name=request.last_name,
            is_admin=False,
            credit_balance=0.0,
            created_at=None
        )
        logger.info(f"Returning UserResponse: {response}")
        return response
    except Exception as e:
        logger.error(f"Error in register_legacy: {type(e).__name__}: {str(e)}")
        raise
