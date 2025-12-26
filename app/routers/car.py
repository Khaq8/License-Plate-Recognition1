"""
Car Router for License Plate Recognition System
Handles vehicle registration and management using Supabase.
"""

from fastapi import status, HTTPException, Depends, APIRouter
from pydantic import BaseModel, constr
from typing import List, Optional
from datetime import datetime

from app.supabase_client import get_supabase_admin
from app.security import get_current_user, CurrentUser


router = APIRouter(prefix="/cars", tags=["Cars"])


# ============== Schemas ==============

class CarCreate(BaseModel):
    license_plate: constr(min_length=2, max_length=15)
    brand: Optional[str] = None
    model: Optional[str] = None
    color: Optional[str] = None
    is_primary: bool = False


class CarUpdate(BaseModel):
    brand: Optional[str] = None
    model: Optional[str] = None
    color: Optional[str] = None
    is_primary: Optional[bool] = None


class CarResponse(BaseModel):
    id: int
    user_id: str
    license_plate: str
    brand: Optional[str]
    model: Optional[str]
    color: Optional[str]
    is_primary: bool
    created_at: datetime


# ============== Endpoints ==============

@router.post("/", status_code=status.HTTP_201_CREATED, response_model=CarResponse)
async def register_car(
    car: CarCreate,
    current_user: CurrentUser = Depends(get_current_user)
):
    """
    Register a new car for the authenticated user.
    """
    supabase = get_supabase_admin()

    # Check if the license plate already exists globally
    existing = supabase.table("cars").select("id").eq(
        "license_plate", car.license_plate.upper()
    ).execute()

    if existing.data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A car with this license plate is already registered"
        )

    # If this is marked as primary, unset other primary cars for this user
    if car.is_primary:
        supabase.table("cars").update({"is_primary": False}).eq(
            "user_id", current_user.id
        ).execute()

    # Create new car
    result = supabase.table("cars").insert({
        "user_id": current_user.id,
        "license_plate": car.license_plate.upper(),
        "brand": car.brand,
        "model": car.model,
        "color": car.color,
        "is_primary": car.is_primary
    }).execute()

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to register car"
        )

    return CarResponse(**result.data[0])


@router.get("/", response_model=List[CarResponse])
async def get_user_cars(
    current_user: CurrentUser = Depends(get_current_user)
):
    """
    Get all cars registered by the authenticated user.
    """
    supabase = get_supabase_admin()

    result = supabase.table("cars").select("*").eq(
        "user_id", current_user.id
    ).order("created_at", desc=True).execute()

    return [CarResponse(**car) for car in result.data]


@router.get("/{car_id}", response_model=CarResponse)
async def get_car(
    car_id: int,
    current_user: CurrentUser = Depends(get_current_user)
):
    """
    Get a specific car by ID. Only the owner can access their car.
    """
    supabase = get_supabase_admin()

    result = supabase.table("cars").select("*").eq("id", car_id).eq(
        "user_id", current_user.id
    ).single().execute()

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Car not found"
        )

    return CarResponse(**result.data)


@router.put("/{car_id}", response_model=CarResponse)
async def update_car(
    car_id: int,
    car_update: CarUpdate,
    current_user: CurrentUser = Depends(get_current_user)
):
    """
    Update a car's details. Only the owner can update their car.
    """
    supabase = get_supabase_admin()

    # First check if car exists and belongs to user
    existing = supabase.table("cars").select("*").eq("id", car_id).eq(
        "user_id", current_user.id
    ).single().execute()

    if not existing.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Car not found"
        )

    # Build update data (only include non-None fields)
    update_data = {k: v for k, v in car_update.model_dump().items() if v is not None}

    if not update_data:
        return CarResponse(**existing.data)

    # If setting as primary, unset other primary cars
    if update_data.get("is_primary"):
        supabase.table("cars").update({"is_primary": False}).eq(
            "user_id", current_user.id
        ).neq("id", car_id).execute()

    result = supabase.table("cars").update(update_data).eq("id", car_id).execute()

    return CarResponse(**result.data[0])


@router.delete("/{car_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_car(
    car_id: int,
    current_user: CurrentUser = Depends(get_current_user)
):
    """
    Delete a car. Only the owner can delete their car.
    """
    supabase = get_supabase_admin()

    # Check if car exists and belongs to user
    existing = supabase.table("cars").select("id").eq("id", car_id).eq(
        "user_id", current_user.id
    ).single().execute()

    if not existing.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Car not found"
        )

    supabase.table("cars").delete().eq("id", car_id).execute()

    return None


@router.post("/{car_id}/set-primary", response_model=CarResponse)
async def set_primary_car(
    car_id: int,
    current_user: CurrentUser = Depends(get_current_user)
):
    """
    Set a car as the primary vehicle for the user.
    """
    supabase = get_supabase_admin()

    # Check if car exists and belongs to user
    existing = supabase.table("cars").select("*").eq("id", car_id).eq(
        "user_id", current_user.id
    ).single().execute()

    if not existing.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Car not found"
        )

    # Unset all other primary cars for this user
    supabase.table("cars").update({"is_primary": False}).eq(
        "user_id", current_user.id
    ).execute()

    # Set this car as primary
    result = supabase.table("cars").update({"is_primary": True}).eq(
        "id", car_id
    ).execute()

    return CarResponse(**result.data[0])
