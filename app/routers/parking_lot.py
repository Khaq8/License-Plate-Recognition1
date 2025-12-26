"""
Parking Lot Router for License Plate Recognition System
Handles parking lot management using Supabase.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime
from decimal import Decimal

from app.supabase_client import get_supabase_admin
from app.security import get_current_user, get_current_admin, CurrentUser
from app.cache import redis_cache


router = APIRouter(
    prefix="/lots",
    tags=["Parking Lots"]
)


# ============== Schemas ==============

class ParkingLotCreate(BaseModel):
    name: str
    address: Optional[str] = None
    city: Optional[str] = None
    capacity: int = Field(..., gt=0)
    hourly_rate: Decimal = Field(default=Decimal("1.00"), ge=0)


class ParkingLotUpdate(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    capacity: Optional[int] = Field(None, gt=0)
    hourly_rate: Optional[Decimal] = Field(None, ge=0)
    is_active: Optional[bool] = None


class ParkingLotResponse(BaseModel):
    id: int
    name: str
    address: Optional[str]
    city: Optional[str]
    capacity: int
    hourly_rate: Decimal
    is_active: bool
    created_at: datetime


class ParkingLotStatus(BaseModel):
    lot_id: int
    name: str
    capacity: int
    current_occupancy: int
    available_spots: int
    occupancy_percentage: float


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
    duration_minutes: Optional[int]
    amount_charged: Optional[Decimal]
    status: str
    is_force_checkout: bool
    created_at: datetime


# ============== Endpoints ==============

@router.post("/", response_model=ParkingLotResponse, status_code=status.HTTP_201_CREATED)
async def create_parking_lot(
    lot: ParkingLotCreate,
    admin: CurrentUser = Depends(get_current_admin)
):
    """Create a new parking lot (admin only)."""
    supabase = get_supabase_admin()

    # Check if lot name already exists
    existing = supabase.table("parking_lots").select("id").eq("name", lot.name).execute()
    if existing.data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A parking lot with this name already exists"
        )

    result = supabase.table("parking_lots").insert({
        "name": lot.name,
        "address": lot.address,
        "city": lot.city,
        "capacity": lot.capacity,
        "hourly_rate": float(lot.hourly_rate)
    }).execute()

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create parking lot"
        )

    return ParkingLotResponse(**result.data[0])


@router.get("/", response_model=List[ParkingLotResponse])
async def get_parking_lots(
    current_user: CurrentUser = Depends(get_current_user)
):
    """Get all active parking lots (visible to authenticated users)."""
    supabase = get_supabase_admin()

    # Admins can see all lots, regular users see only active
    if current_user.is_admin:
        result = supabase.table("parking_lots").select("*").order("name").execute()
    else:
        result = supabase.table("parking_lots").select("*").eq(
            "is_active", True
        ).order("name").execute()

    return [ParkingLotResponse(**lot) for lot in result.data]


@router.get("/{lot_id}", response_model=ParkingLotResponse)
async def get_parking_lot(
    lot_id: int,
    current_user: CurrentUser = Depends(get_current_user)
):
    """Get a specific parking lot."""
    supabase = get_supabase_admin()

    result = supabase.table("parking_lots").select("*").eq("id", lot_id).single().execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Parking lot not found")

    # Non-admins can only see active lots
    if not current_user.is_admin and not result.data.get("is_active"):
        raise HTTPException(status_code=404, detail="Parking lot not found")

    return ParkingLotResponse(**result.data)


@router.put("/{lot_id}", response_model=ParkingLotResponse)
async def update_parking_lot(
    lot_id: int,
    lot_update: ParkingLotUpdate,
    admin: CurrentUser = Depends(get_current_admin)
):
    """Update a parking lot (admin only)."""
    supabase = get_supabase_admin()

    # Check if lot exists
    existing = supabase.table("parking_lots").select("*").eq("id", lot_id).single().execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Parking lot not found")

    # Build update data
    update_data = {k: v for k, v in lot_update.model_dump().items() if v is not None}

    if "hourly_rate" in update_data:
        update_data["hourly_rate"] = float(update_data["hourly_rate"])

    if not update_data:
        return ParkingLotResponse(**existing.data)

    result = supabase.table("parking_lots").update(update_data).eq("id", lot_id).execute()

    # Invalidate cache
    await redis_cache.invalidate_lot(lot_id)

    return ParkingLotResponse(**result.data[0])


@router.get("/{lot_id}/status", response_model=ParkingLotStatus)
async def get_lot_status(
    lot_id: int,
    current_user: CurrentUser = Depends(get_current_user)
):
    """Get real-time occupancy status for a parking lot."""
    supabase = get_supabase_admin()

    # Try cache first
    cached_status = await redis_cache.get_lot_status(lot_id)
    if cached_status:
        return cached_status

    # Get lot details
    lot = supabase.table("parking_lots").select("*").eq("id", lot_id).single().execute()
    if not lot.data:
        raise HTTPException(status_code=404, detail="Parking lot not found")

    lot_data = lot.data

    # Count active sessions
    active_sessions = supabase.table("parking_sessions").select(
        "id", count="exact"
    ).eq("lot_id", lot_id).eq("status", "active").is_("exit_time", "null").execute()

    current_occupancy = active_sessions.count or 0
    capacity = lot_data["capacity"]
    available_spots = max(0, capacity - current_occupancy)
    occupancy_percentage = (current_occupancy / capacity * 100) if capacity > 0 else 0

    status_data = {
        "lot_id": lot_data["id"],
        "name": lot_data["name"],
        "capacity": capacity,
        "current_occupancy": current_occupancy,
        "available_spots": available_spots,
        "occupancy_percentage": round(occupancy_percentage, 1)
    }

    # Cache the result
    await redis_cache.set_lot_status(lot_id, status_data)

    return ParkingLotStatus(**status_data)


@router.get("/{lot_id}/active", response_model=List[ParkingSessionResponse])
async def get_active_vehicles(
    lot_id: int,
    admin: CurrentUser = Depends(get_current_admin)
):
    """Get all currently parked vehicles in a lot (admin only)."""
    supabase = get_supabase_admin()

    # Try cache first
    cached_sessions = await redis_cache.get_active_sessions(lot_id)
    if cached_sessions:
        return cached_sessions

    result = supabase.table("parking_sessions").select("*").eq(
        "lot_id", lot_id
    ).eq("status", "active").is_("exit_time", "null").order(
        "entry_time", desc=True
    ).execute()

    sessions = [ParkingSessionResponse(**s) for s in result.data]

    # Cache results
    await redis_cache.set_active_sessions(lot_id, [s.model_dump() for s in sessions])

    return sessions


@router.delete("/{lot_id}", status_code=status.HTTP_204_NO_CONTENT)
async def deactivate_parking_lot(
    lot_id: int,
    admin: CurrentUser = Depends(get_current_admin)
):
    """Deactivate a parking lot (soft delete, admin only)."""
    supabase = get_supabase_admin()

    # Check if lot exists
    lot = supabase.table("parking_lots").select("*").eq("id", lot_id).single().execute()
    if not lot.data:
        raise HTTPException(status_code=404, detail="Parking lot not found")

    # Check for active sessions
    active_sessions = supabase.table("parking_sessions").select(
        "id", count="exact"
    ).eq("lot_id", lot_id).eq("status", "active").is_("exit_time", "null").execute()

    if active_sessions.count and active_sessions.count > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot deactivate lot with {active_sessions.count} active parking sessions"
        )

    # Soft delete (deactivate)
    supabase.table("parking_lots").update({"is_active": False}).eq("id", lot_id).execute()

    # Invalidate cache
    await redis_cache.invalidate_lot(lot_id)

    return None
