"""
Parking Router for License Plate Recognition System
Handles parking session management using Supabase.
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel, constr
from typing import List, Optional
from datetime import datetime, timezone
from decimal import Decimal
import math

from app.supabase_client import get_supabase_admin
from app.security import get_current_user, get_current_admin, CurrentUser
from app.cache import redis_cache


router = APIRouter(
    prefix="/parking",
    tags=["Parking"]
)


# ============== Schemas ==============

class ParkingSessionCreate(BaseModel):
    plate: constr(min_length=2, max_length=15)
    entry_confidence: Optional[float] = None
    entry_image_url: Optional[str] = None


class ParkingSessionResponse(BaseModel):
    id: int
    lot_id: int
    plate: str
    car_id: Optional[int]
    user_id: Optional[str]
    entry_time: datetime
    exit_time: Optional[datetime]
    entry_image_url: Optional[str]
    exit_image_url: Optional[str]
    entry_confidence: Optional[float]
    exit_confidence: Optional[float]
    duration_minutes: Optional[int]
    amount_charged: Optional[Decimal]
    status: str
    is_force_checkout: bool
    created_at: datetime


class ParkingSessionWithDetails(ParkingSessionResponse):
    lot_name: Optional[str] = None
    username: Optional[str] = None
    car_brand: Optional[str] = None


class ForceCheckoutRequest(BaseModel):
    reason: Optional[str] = None


class ForceCheckoutResponse(BaseModel):
    session: ParkingSessionResponse
    amount_charged: Decimal
    message: str


# ============== Helper Functions ==============

def calculate_charge(entry_time: datetime, exit_time: datetime, hourly_rate: float) -> Decimal:
    """Calculate parking charge based on duration and hourly rate."""
    duration = exit_time - entry_time
    hours = duration.total_seconds() / 3600
    hours_charged = math.ceil(hours) if hours > 0 else 1
    return Decimal(str(hours_charged)) * Decimal(str(hourly_rate))


def get_duration_minutes(entry_time: datetime, exit_time: datetime = None) -> int:
    """Calculate duration in minutes."""
    end_time = exit_time or datetime.now(timezone.utc)
    if isinstance(entry_time, str):
        entry_time = datetime.fromisoformat(entry_time.replace('Z', '+00:00'))
    if isinstance(end_time, str):
        end_time = datetime.fromisoformat(end_time.replace('Z', '+00:00'))
    duration = end_time - entry_time
    return int(duration.total_seconds() / 60)


# ============== Endpoints ==============

@router.post("/{lot_id}/entry", response_model=ParkingSessionResponse, status_code=status.HTTP_201_CREATED)
async def record_entry(
    lot_id: int,
    entry: ParkingSessionCreate,
    admin: CurrentUser = Depends(get_current_admin)
):
    """Record a vehicle entry to the parking lot (admin only)."""
    supabase = get_supabase_admin()
    plate = entry.plate.upper().strip()

    # Check for duplicate entry
    if await redis_cache.check_duplicate_entry(plate, lot_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This plate was just recorded. Please wait a few seconds."
        )

    # Check if vehicle is already parked in this lot
    existing = supabase.table("parking_sessions").select("id").eq(
        "lot_id", lot_id
    ).eq("plate", plate).eq("status", "active").is_("exit_time", "null").execute()

    if existing.data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This vehicle is already parked in this lot"
        )

    # Check lot capacity
    lot = supabase.table("parking_lots").select("*").eq("id", lot_id).single().execute()
    if not lot.data:
        raise HTTPException(status_code=404, detail="Parking lot not found")

    lot_data = lot.data

    # Count active sessions
    active_count = supabase.table("parking_sessions").select(
        "id", count="exact"
    ).eq("lot_id", lot_id).eq("status", "active").is_("exit_time", "null").execute()

    if (active_count.count or 0) >= lot_data["capacity"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Parking lot is full"
        )

    # Try to match with a registered car
    car = supabase.table("cars").select("id, user_id").eq("license_plate", plate).execute()
    car_data = car.data[0] if car.data else None

    # Create parking session
    session_data = {
        "lot_id": lot_id,
        "plate": plate,
        "car_id": car_data["id"] if car_data else None,
        "user_id": car_data["user_id"] if car_data else None,
        "entry_confidence": entry.entry_confidence,
        "entry_image_url": entry.entry_image_url,
        "status": "active"
    }

    result = supabase.table("parking_sessions").insert(session_data).execute()

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create parking session"
        )

    session = result.data[0]

    # Mark plate as seen
    await redis_cache.mark_plate_seen(plate, lot_id)

    # Invalidate lot cache
    await redis_cache.invalidate_lot(lot_id)

    # Cache user's active session if applicable
    if session.get("user_id"):
        await redis_cache.set_user_active_session(session["user_id"], {
            "session_id": session["id"],
            "lot_id": lot_id,
            "plate": plate,
            "entry_time": session["entry_time"]
        })

    return ParkingSessionResponse(**session)


@router.post("/{lot_id}/exit", response_model=ParkingSessionResponse)
async def record_exit(
    lot_id: int,
    plate: str = Query(..., min_length=2, max_length=15),
    exit_confidence: Optional[float] = None,
    admin: CurrentUser = Depends(get_current_admin)
):
    """Record a vehicle exit from the parking lot (admin only)."""
    supabase = get_supabase_admin()
    plate = plate.upper().strip()

    # Find active session
    session_result = supabase.table("parking_sessions").select("*").eq(
        "lot_id", lot_id
    ).eq("plate", plate).eq("status", "active").is_("exit_time", "null").single().execute()

    if not session_result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No active parking session found for this plate"
        )

    session = session_result.data

    # Get lot for pricing
    lot = supabase.table("parking_lots").select("hourly_rate").eq("id", lot_id).single().execute()

    # Calculate charge
    exit_time = datetime.now(timezone.utc)
    entry_time = datetime.fromisoformat(session["entry_time"].replace('Z', '+00:00'))
    amount = calculate_charge(entry_time, exit_time, lot.data["hourly_rate"])
    duration = get_duration_minutes(entry_time, exit_time)

    # Update session
    update_result = supabase.table("parking_sessions").update({
        "exit_time": exit_time.isoformat(),
        "exit_confidence": exit_confidence,
        "amount_charged": float(amount),
        "duration_minutes": duration,
        "status": "completed"
    }).eq("id", session["id"]).execute()

    # Clear plate seen marker
    await redis_cache.clear_plate_seen(plate, lot_id)

    # Invalidate caches
    await redis_cache.invalidate_lot(lot_id)
    if session.get("user_id"):
        await redis_cache.clear_user_active_session(session["user_id"])

    return ParkingSessionResponse(**update_result.data[0])


@router.post("/sessions/{session_id}/force-checkout", response_model=ForceCheckoutResponse)
async def force_checkout(
    session_id: int,
    request: ForceCheckoutRequest = None,
    admin: CurrentUser = Depends(get_current_admin)
):
    """Force checkout a vehicle and charge the user (admin only)."""
    supabase = get_supabase_admin()

    # Get session
    session_result = supabase.table("parking_sessions").select("*").eq("id", session_id).single().execute()

    if not session_result.data:
        raise HTTPException(status_code=404, detail="Parking session not found")

    session = session_result.data

    if session.get("exit_time"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This session has already been checked out"
        )

    # Get lot for pricing
    lot = supabase.table("parking_lots").select("name, hourly_rate").eq(
        "id", session["lot_id"]
    ).single().execute()

    # Calculate charge
    exit_time = datetime.now(timezone.utc)
    entry_time = datetime.fromisoformat(session["entry_time"].replace('Z', '+00:00'))
    amount = calculate_charge(entry_time, exit_time, lot.data["hourly_rate"])
    duration = get_duration_minutes(entry_time, exit_time)

    # Update session
    update_result = supabase.table("parking_sessions").update({
        "exit_time": exit_time.isoformat(),
        "amount_charged": float(amount),
        "duration_minutes": duration,
        "status": "completed",
        "is_force_checkout": True
    }).eq("id", session_id).execute()

    # If there's a user, deduct from their credit
    if session.get("user_id"):
        # Get current balance
        profile = supabase.table("profiles").select("credit_balance").eq(
            "id", session["user_id"]
        ).single().execute()

        if profile.data:
            new_balance = float(profile.data["credit_balance"]) - float(amount)

            # Update balance
            supabase.table("profiles").update({
                "credit_balance": new_balance
            }).eq("id", session["user_id"]).execute()

            # Create transaction record
            supabase.table("transactions").insert({
                "user_id": session["user_id"],
                "session_id": session_id,
                "amount": -float(amount),
                "type": "payment",
                "balance_after": new_balance,
                "description": f"Force checkout from {lot.data['name']}"
            }).execute()

    # Clear caches
    await redis_cache.clear_plate_seen(session["plate"], session["lot_id"])
    await redis_cache.invalidate_lot(session["lot_id"])
    if session.get("user_id"):
        await redis_cache.clear_user_active_session(session["user_id"])

    return ForceCheckoutResponse(
        session=ParkingSessionResponse(**update_result.data[0]),
        amount_charged=amount,
        message=f"Vehicle {session['plate']} has been force checked out. Charged: ${amount:.2f}"
    )


@router.get("/sessions", response_model=List[ParkingSessionWithDetails])
async def get_sessions(
    lot_id: Optional[int] = None,
    plate: Optional[str] = None,
    active_only: bool = False,
    skip: int = 0,
    limit: int = 100,
    admin: CurrentUser = Depends(get_current_admin)
):
    """Get parking sessions with optional filters (admin only)."""
    supabase = get_supabase_admin()

    # Build query
    query = supabase.table("parking_sessions").select("*")

    if lot_id:
        query = query.eq("lot_id", lot_id)

    if plate:
        query = query.ilike("plate", f"%{plate.upper()}%")

    if active_only:
        query = query.eq("status", "active").is_("exit_time", "null")

    result = query.order("entry_time", desc=True).range(skip, skip + limit - 1).execute()

    # Enrich with details
    results = []
    for session in result.data:
        # Get lot name
        lot_name = None
        if session.get("lot_id"):
            lot = supabase.table("parking_lots").select("name").eq("id", session["lot_id"]).execute()
            lot_name = lot.data[0]["name"] if lot.data else None

        # Get username
        username = None
        if session.get("user_id"):
            user = supabase.table("profiles").select("username").eq("id", session["user_id"]).execute()
            username = user.data[0]["username"] if user.data else None

        # Get car brand
        car_brand = None
        if session.get("car_id"):
            car = supabase.table("cars").select("brand").eq("id", session["car_id"]).execute()
            car_brand = car.data[0]["brand"] if car.data else None

        # Calculate duration if not set
        duration = session.get("duration_minutes")
        if not duration:
            duration = get_duration_minutes(session["entry_time"], session.get("exit_time"))

        session_dict = {**session, "duration_minutes": duration}
        session_dict["lot_name"] = lot_name
        session_dict["username"] = username
        session_dict["car_brand"] = car_brand

        results.append(ParkingSessionWithDetails(**session_dict))

    return results


@router.get("/my-sessions", response_model=List[ParkingSessionResponse])
async def get_my_sessions(
    active_only: bool = False,
    skip: int = 0,
    limit: int = 50,
    current_user: CurrentUser = Depends(get_current_user)
):
    """Get the current user's parking sessions."""
    supabase = get_supabase_admin()

    query = supabase.table("parking_sessions").select("*").eq("user_id", current_user.id)

    if active_only:
        query = query.eq("status", "active").is_("exit_time", "null")

    result = query.order("entry_time", desc=True).range(skip, skip + limit - 1).execute()

    return [ParkingSessionResponse(**s) for s in result.data]


@router.get("/my-active-session", response_model=Optional[ParkingSessionResponse])
async def get_my_active_session(
    current_user: CurrentUser = Depends(get_current_user)
):
    """Get the current user's active parking session (if any)."""
    # Try cache first
    cached = await redis_cache.get_user_active_session(current_user.id)
    if cached:
        supabase = get_supabase_admin()
        session = supabase.table("parking_sessions").select("*").eq(
            "id", cached["session_id"]
        ).single().execute()
        if session.data and session.data.get("status") == "active":
            return ParkingSessionResponse(**session.data)

    # Query database
    supabase = get_supabase_admin()
    result = supabase.table("parking_sessions").select("*").eq(
        "user_id", current_user.id
    ).eq("status", "active").is_("exit_time", "null").order(
        "entry_time", desc=True
    ).limit(1).execute()

    if result.data:
        return ParkingSessionResponse(**result.data[0])

    return None
