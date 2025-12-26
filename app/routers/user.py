"""
User Router for License Plate Recognition System
Handles user management using Supabase.
"""

from fastapi import status, HTTPException, Depends, APIRouter
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

from app.supabase_client import get_supabase_admin
from app.security import get_current_admin, CurrentUser


router = APIRouter(prefix="/users", tags=["Users"])


# ============== Schemas ==============

class UserCreate(BaseModel):
    username: str
    password: str
    email: Optional[str] = None
    full_name: Optional[str] = None


class UserResponse(BaseModel):
    id: str
    username: str
    email: Optional[str]
    full_name: Optional[str]
    is_admin: bool
    credit_balance: float
    created_at: Optional[datetime]


# ============== Endpoints ==============

@router.post("/", status_code=status.HTTP_201_CREATED, response_model=UserResponse)
async def create_user(user: UserCreate):
    """
    Create a new user (public registration).
    Note: Use /auth/signup instead for Supabase Auth integration.
    """
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Please use /auth/signup for user registration"
    )


@router.post("/admin", status_code=status.HTTP_201_CREATED, response_model=UserResponse)
async def create_user_admin(
    user: UserCreate,
    is_admin: bool = False,
    admin: CurrentUser = Depends(get_current_admin)
):
    """
    Create a new user with optional admin privileges (admin only).
    """
    supabase = get_supabase_admin()

    # Check if username already exists
    existing = supabase.table("profiles").select("id").eq("username", user.username).execute()
    if existing.data:
        raise HTTPException(status_code=400, detail="Username already registered")

    # Create user via Supabase Auth admin API
    try:
        auth_response = supabase.auth.admin.create_user({
            "email": user.email,
            "password": user.password,
            "email_confirm": True,  # Auto-confirm email for admin-created users
            "user_metadata": {
                "username": user.username,
                "full_name": user.full_name
            }
        })

        if not auth_response.user:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create user"
            )

        # Update profile to set admin status if needed
        if is_admin:
            supabase.table("profiles").update({
                "is_admin": True
            }).eq("id", auth_response.user.id).execute()

        # Fetch the created profile
        profile = supabase.table("profiles").select("*").eq(
            "id", auth_response.user.id
        ).single().execute()

        return UserResponse(
            id=profile.data["id"],
            username=profile.data["username"],
            email=profile.data.get("email"),
            full_name=profile.data.get("full_name"),
            is_admin=profile.data.get("is_admin", False),
            credit_balance=float(profile.data.get("credit_balance", 0)),
            created_at=profile.data.get("created_at")
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create user: {str(e)}"
        )
