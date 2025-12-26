"""
Admin Router for License Plate Recognition System
Handles admin-only operations using Supabase.
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timezone
from decimal import Decimal
import math

from app.supabase_client import get_supabase_admin
from app.security import get_current_admin, CurrentUser
from app.cache import redis_cache


router = APIRouter(
    prefix="/admin",
    tags=["Admin"]
)


# ============== Schemas ==============

class UserWithDetails(BaseModel):
    id: str
    username: str
    email: Optional[str]
    full_name: Optional[str]
    is_admin: bool
    credit_balance: float
    phone: Optional[str]
    created_at: Optional[datetime]
    cars_count: int = 0
    active_sessions_count: int = 0


class ParkingSessionWithDetails(BaseModel):
    id: int
    lot_id: int
    plate: str
    car_id: Optional[int]
    user_id: Optional[str]
    entry_time: datetime
    exit_time: Optional[datetime]
    duration_minutes: Optional[int]
    amount_charged: Optional[Decimal]
    status: str
    lot_name: Optional[str] = None
    username: Optional[str] = None
    car_brand: Optional[str] = None


class TransactionResponse(BaseModel):
    id: int
    user_id: str
    session_id: Optional[int]
    type: str
    amount: Decimal
    balance_after: Decimal
    description: Optional[str]
    created_at: datetime


class ActiveUserInLot(BaseModel):
    user_id: Optional[str]
    username: Optional[str]
    plate: str
    car_brand: Optional[str]
    entry_time: datetime
    duration_minutes: int
    estimated_charge: Decimal
    session_id: int


# ============== Helper Functions ==============

def calculate_estimated_charge(entry_time: datetime, hourly_rate: float) -> Decimal:
    """Calculate estimated charge for an active session."""
    if isinstance(entry_time, str):
        entry_time = datetime.fromisoformat(entry_time.replace('Z', '+00:00'))
    duration = datetime.now(timezone.utc) - entry_time
    hours = duration.total_seconds() / 3600
    hours_charged = math.ceil(hours) if hours > 0 else 1
    return Decimal(str(hours_charged)) * Decimal(str(hourly_rate))


def get_duration_minutes(entry_time: datetime, exit_time: datetime = None) -> int:
    """Calculate duration in minutes."""
    if isinstance(entry_time, str):
        entry_time = datetime.fromisoformat(entry_time.replace('Z', '+00:00'))
    end_time = exit_time or datetime.now(timezone.utc)
    if isinstance(end_time, str):
        end_time = datetime.fromisoformat(end_time.replace('Z', '+00:00'))
    duration = end_time - entry_time
    return int(duration.total_seconds() / 60)


# ============== Endpoints ==============

@router.get("/users", response_model=List[UserWithDetails])
async def get_all_users(
    search: Optional[str] = None,
    has_active_session: Optional[bool] = None,
    skip: int = 0,
    limit: int = 100,
    admin: CurrentUser = Depends(get_current_admin)
):
    """Get all users with optional filters (admin only)."""
    supabase = get_supabase_admin()

    # Get all profiles
    query = supabase.table("profiles").select("*")

    if search:
        query = query.or_(f"username.ilike.%{search}%,phone.ilike.%{search}%")

    result = query.range(skip, skip + limit - 1).execute()

    results = []
    for user in result.data:
        # Count cars
        cars = supabase.table("cars").select("id", count="exact").eq(
            "user_id", user["id"]
        ).execute()
        cars_count = cars.count or 0

        # Count active sessions
        active = supabase.table("parking_sessions").select("id", count="exact").eq(
            "user_id", user["id"]
        ).eq("status", "active").is_("exit_time", "null").execute()
        active_sessions_count = active.count or 0

        # Apply active session filter
        if has_active_session is not None:
            if has_active_session and active_sessions_count == 0:
                continue
            if not has_active_session and active_sessions_count > 0:
                continue

        results.append(UserWithDetails(
            id=user["id"],
            username=user["username"],
            email=user.get("email"),
            full_name=user.get("full_name"),
            is_admin=user.get("is_admin", False),
            credit_balance=float(user.get("credit_balance", 0)),
            phone=user.get("phone"),
            created_at=user.get("created_at"),
            cars_count=cars_count,
            active_sessions_count=active_sessions_count
        ))

    return results


@router.get("/users/{user_id}/sessions", response_model=List[ParkingSessionWithDetails])
async def get_user_sessions(
    user_id: str,
    active_only: bool = False,
    skip: int = 0,
    limit: int = 50,
    admin: CurrentUser = Depends(get_current_admin)
):
    """Get parking history for a specific user (admin only)."""
    supabase = get_supabase_admin()

    # Check user exists
    user = supabase.table("profiles").select("username").eq("id", user_id).single().execute()
    if not user.data:
        raise HTTPException(status_code=404, detail="User not found")

    # Get sessions
    query = supabase.table("parking_sessions").select("*").eq("user_id", user_id)

    if active_only:
        query = query.eq("status", "active").is_("exit_time", "null")

    result = query.order("entry_time", desc=True).range(skip, skip + limit - 1).execute()

    results = []
    for session in result.data:
        # Get lot name
        lot_name = None
        if session.get("lot_id"):
            lot = supabase.table("parking_lots").select("name").eq("id", session["lot_id"]).execute()
            lot_name = lot.data[0]["name"] if lot.data else None

        # Get car brand
        car_brand = None
        if session.get("car_id"):
            car = supabase.table("cars").select("brand").eq("id", session["car_id"]).execute()
            car_brand = car.data[0]["brand"] if car.data else None

        duration = get_duration_minutes(session["entry_time"], session.get("exit_time"))

        results.append(ParkingSessionWithDetails(
            id=session["id"],
            lot_id=session["lot_id"],
            plate=session["plate"],
            car_id=session.get("car_id"),
            user_id=session.get("user_id"),
            entry_time=session["entry_time"],
            exit_time=session.get("exit_time"),
            duration_minutes=duration,
            amount_charged=session.get("amount_charged"),
            status=session["status"],
            lot_name=lot_name,
            username=user.data["username"],
            car_brand=car_brand
        ))

    return results


@router.post("/users/{user_id}/charge", response_model=TransactionResponse)
async def charge_user(
    user_id: str,
    amount: Decimal = Query(..., gt=0),
    reason: Optional[str] = None,
    admin: CurrentUser = Depends(get_current_admin)
):
    """Manually charge a user's credit balance (admin only)."""
    supabase = get_supabase_admin()

    # Check user exists and get current balance
    user = supabase.table("profiles").select("credit_balance").eq("id", user_id).single().execute()
    if not user.data:
        raise HTTPException(status_code=404, detail="User not found")

    # Calculate new balance
    new_balance = float(user.data["credit_balance"]) - float(amount)

    # Update balance
    supabase.table("profiles").update({
        "credit_balance": new_balance
    }).eq("id", user_id).execute()

    # Create transaction record
    transaction = supabase.table("transactions").insert({
        "user_id": user_id,
        "session_id": None,
        "amount": -float(amount),
        "type": "payment",
        "balance_after": new_balance,
        "description": "Manual charge by admin" + (f": {reason}" if reason else "")
    }).execute()

    return TransactionResponse(**transaction.data[0])


@router.get("/lots/{lot_id}/active-users", response_model=List[ActiveUserInLot])
async def get_active_users_in_lot(
    lot_id: int,
    search: Optional[str] = None,
    admin: CurrentUser = Depends(get_current_admin)
):
    """Get all users currently parked in a specific lot (admin only)."""
    supabase = get_supabase_admin()

    # Check lot exists and get hourly rate
    lot = supabase.table("parking_lots").select("hourly_rate").eq("id", lot_id).single().execute()
    if not lot.data:
        raise HTTPException(status_code=404, detail="Parking lot not found")

    hourly_rate = lot.data["hourly_rate"]

    # Get active sessions
    result = supabase.table("parking_sessions").select("*").eq(
        "lot_id", lot_id
    ).eq("status", "active").is_("exit_time", "null").order("entry_time").execute()

    results = []
    for session in result.data:
        # Get username if user exists
        username = None
        if session.get("user_id"):
            user = supabase.table("profiles").select("username").eq("id", session["user_id"]).execute()
            username = user.data[0]["username"] if user.data else None

        # Get car brand if car exists
        car_brand = None
        if session.get("car_id"):
            car = supabase.table("cars").select("brand").eq("id", session["car_id"]).execute()
            car_brand = car.data[0]["brand"] if car.data else None

        # Apply search filter
        if search:
            search_lower = search.lower()
            plate_match = search_lower in session["plate"].lower()
            username_match = username and search_lower in username.lower()
            brand_match = car_brand and search_lower in car_brand.lower()
            if not (plate_match or username_match or brand_match):
                continue

        duration_minutes = get_duration_minutes(session["entry_time"])
        estimated_charge = calculate_estimated_charge(session["entry_time"], hourly_rate)

        results.append(ActiveUserInLot(
            user_id=session.get("user_id"),
            username=username,
            plate=session["plate"],
            car_brand=car_brand,
            entry_time=session["entry_time"],
            duration_minutes=duration_minutes,
            estimated_charge=estimated_charge,
            session_id=session["id"]
        ))

    return results


@router.post("/users/{user_id}/top-up", response_model=TransactionResponse)
async def top_up_user(
    user_id: str,
    amount: Decimal = Query(..., gt=0),
    reason: Optional[str] = None,
    admin: CurrentUser = Depends(get_current_admin)
):
    """Add credit to a user's balance (admin only)."""
    supabase = get_supabase_admin()

    # Check user exists and get current balance
    user = supabase.table("profiles").select("credit_balance").eq("id", user_id).single().execute()
    if not user.data:
        raise HTTPException(status_code=404, detail="User not found")

    # Calculate new balance
    new_balance = float(user.data["credit_balance"]) + float(amount)

    # Update balance
    supabase.table("profiles").update({
        "credit_balance": new_balance
    }).eq("id", user_id).execute()

    # Create transaction record
    transaction = supabase.table("transactions").insert({
        "user_id": user_id,
        "session_id": None,
        "amount": float(amount),
        "type": "top_up",
        "balance_after": new_balance,
        "description": "Credit top-up by admin" + (f": {reason}" if reason else "")
    }).execute()

    return TransactionResponse(**transaction.data[0])


@router.put("/users/{user_id}/admin-status")
async def set_admin_status(
    user_id: str,
    is_admin: bool,
    admin: CurrentUser = Depends(get_current_admin)
):
    """Set or remove admin status for a user (admin only)."""
    supabase = get_supabase_admin()

    # Check user exists
    user = supabase.table("profiles").select("id").eq("id", user_id).single().execute()
    if not user.data:
        raise HTTPException(status_code=404, detail="User not found")

    # Prevent removing own admin status
    if user_id == admin.id and not is_admin:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot remove your own admin status"
        )

    # Update admin status
    supabase.table("profiles").update({
        "is_admin": is_admin
    }).eq("id", user_id).execute()

    return {"message": f"Admin status {'granted' if is_admin else 'revoked'} for user {user_id}"}
