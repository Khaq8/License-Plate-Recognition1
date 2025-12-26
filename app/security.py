"""
Security module for License Plate Recognition System
Handles JWT verification with Supabase Auth
"""

from jose import JWTError, jwt
from datetime import datetime, timedelta
from typing import Optional
from fastapi import Depends, status, HTTPException, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel

from .config import settings
from .supabase_client import get_supabase, get_supabase_admin


# HTTP Bearer security scheme
security = HTTPBearer()


class TokenData(BaseModel):
    """Token payload data."""
    user_id: str
    email: Optional[str] = None
    is_admin: bool = False


class CurrentUser(BaseModel):
    """Current authenticated user data."""
    id: str
    email: Optional[str] = None
    username: Optional[str] = None
    full_name: Optional[str] = None
    is_admin: bool = False
    credit_balance: float = 0.0
    phone: Optional[str] = None


def verify_supabase_token(token: str) -> dict:
    """
    Verify a Supabase JWT token.
    Returns the decoded payload if valid.
    """
    try:
        # Try to decode with Supabase JWT secret if available
        if settings.supabase_jwt_secret:
            payload = jwt.decode(
                token,
                settings.supabase_jwt_secret,
                algorithms=["HS256"],
                audience="authenticated"
            )
        else:
            # Fallback: Use Supabase to verify (makes API call)
            supabase = get_supabase()
            user = supabase.auth.get_user(token)
            if user and user.user:
                return {
                    "sub": user.user.id,
                    "email": user.user.email,
                    "role": user.user.role,
                    "user_metadata": user.user.user_metadata
                }
            raise JWTError("Invalid token")

        return payload

    except JWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> CurrentUser:
    """
    FastAPI dependency to get the current authenticated user.
    Verifies the JWT token and fetches user profile from Supabase.
    """
    token = credentials.credentials

    # Verify token
    payload = verify_supabase_token(token)
    user_id = payload.get("sub")

    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Fetch user profile from Supabase
    try:
        supabase_admin = get_supabase_admin()
        result = supabase_admin.table("profiles").select("*").eq("id", user_id).single().execute()

        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User profile not found"
            )

        profile = result.data
        return CurrentUser(
            id=profile["id"],
            email=profile.get("email"),
            username=profile.get("username"),
            full_name=profile.get("full_name"),
            is_admin=profile.get("is_admin", False),
            credit_balance=float(profile.get("credit_balance", 0)),
            phone=profile.get("phone")
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching user profile: {str(e)}"
        )


async def get_current_admin(
    current_user: CurrentUser = Depends(get_current_user)
) -> CurrentUser:
    """
    FastAPI dependency to ensure current user is an admin.
    """
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You must be an admin to access this resource"
        )
    return current_user


def get_optional_user(request: Request) -> Optional[CurrentUser]:
    """
    Get current user if authenticated, otherwise return None.
    Useful for endpoints that work both authenticated and anonymously.
    """
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        return None

    token = auth_header.split(" ")[1]
    try:
        payload = verify_supabase_token(token)
        user_id = payload.get("sub")

        if not user_id:
            return None

        supabase_admin = get_supabase_admin()
        result = supabase_admin.table("profiles").select("*").eq("id", user_id).single().execute()

        if not result.data:
            return None

        profile = result.data
        return CurrentUser(
            id=profile["id"],
            email=profile.get("email"),
            username=profile.get("username"),
            full_name=profile.get("full_name"),
            is_admin=profile.get("is_admin", False),
            credit_balance=float(profile.get("credit_balance", 0)),
            phone=profile.get("phone")
        )
    except Exception:
        return None


# Legacy compatibility aliases
def create_access_token(data: dict, expires_delta: int = None) -> str:
    """
    Legacy function - creates a custom JWT token.
    Note: Prefer using Supabase Auth for new implementations.
    """
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(
        minutes=expires_delta or settings.access_token_expire_minutes
    )
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)


def verify_access_token(token: str) -> TokenData:
    """
    Legacy function - verifies a custom JWT token.
    Note: Prefer using Supabase Auth for new implementations.
    """
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        user_id = payload.get("user_id")
        if user_id is None:
            raise JWTError("No user_id in token")
        return TokenData(
            user_id=str(user_id),
            is_admin=payload.get("is_admin", False)
        )
    except JWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
