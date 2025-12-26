"""
Plate Detection Router for License Plate Recognition System
Handles ALPR detection logs using Supabase.
"""

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

from app.supabase_client import get_supabase_admin
from app.security import get_current_admin, CurrentUser


router = APIRouter(
    prefix="/plates",
    tags=["Plates"]
)


# ============== Schemas ==============

class GovPlateSchema(BaseModel):
    id: int
    gov_plate_numb: str
    plate: str


class PlateDetectionSchema(BaseModel):
    id: int
    session_id: Optional[str]
    timestamp: datetime
    plate: str
    ocr_confidence: float
    detection_confidence: float
    govplate: Optional[GovPlateSchema] = None


class PlateListSchema(BaseModel):
    id: int
    plate: str
    timestamp: datetime
    gov_plate_numb: Optional[str] = None


class PlateResponse(BaseModel):
    id: int
    session_id: str
    timestamp: datetime
    plate: str
    ocr_confidence: float
    detection_confidence: float


class PlateUpdate(BaseModel):
    session_id: Optional[str] = None
    plate: Optional[str] = None
    ocr_confidence: Optional[float] = None
    detection_confidence: Optional[float] = None


# ============== Endpoints ==============

@router.get("/", response_model=List[PlateListSchema])
async def get_all_plates(
    admin: CurrentUser = Depends(get_current_admin)
):
    """Get all plate detections (admin only)."""
    supabase = get_supabase_admin()

    # Get plate detections with gov plate info
    result = supabase.table("plate_detections").select(
        "id, plate, timestamp, gov_plate_numb(gov_plate_numb)"
    ).order("timestamp", desc=True).execute()

    output = []
    for plate in result.data:
        gov_num = None
        if plate.get("gov_plate_numb") and len(plate["gov_plate_numb"]) > 0:
            gov_num = plate["gov_plate_numb"][0].get("gov_plate_numb")

        output.append({
            "id": plate["id"],
            "plate": plate["plate"],
            "timestamp": plate["timestamp"],
            "gov_plate_numb": gov_num
        })

    return output


@router.get("/id/{id}", response_model=PlateDetectionSchema)
async def search_by_id(
    id: int,
    admin: CurrentUser = Depends(get_current_admin)
):
    """Get plate detection by ID (admin only)."""
    supabase = get_supabase_admin()

    result = supabase.table("plate_detections").select("*").eq("id", id).single().execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Plate ID not found")

    # Get gov plate if exists
    gov_plate = supabase.table("gov_plate_numb").select("*").eq(
        "detection_id", id
    ).execute()

    data = result.data
    if gov_plate.data:
        data["govplate"] = gov_plate.data[0]

    return PlateDetectionSchema(**data)


@router.get("/search/{plate}", response_model=List[PlateDetectionSchema])
async def search_plate(
    plate: str,
    admin: CurrentUser = Depends(get_current_admin)
):
    """Search for exact plate matches (admin only)."""
    supabase = get_supabase_admin()

    result = supabase.table("plate_detections").select("*").eq(
        "plate", plate
    ).order("timestamp", desc=True).execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Plate not found")

    return [PlateDetectionSchema(**p) for p in result.data]


@router.get("/search", response_model=List[PlateDetectionSchema])
async def search_plate_partial(
    q: str,
    admin: CurrentUser = Depends(get_current_admin)
):
    """Search for partial plate matches (admin only)."""
    supabase = get_supabase_admin()

    result = supabase.table("plate_detections").select("*").ilike(
        "plate", f"%{q}%"
    ).order("timestamp", desc=True).execute()

    return [PlateDetectionSchema(**p) for p in result.data]


@router.get("/search/{plate}/best", response_model=PlateDetectionSchema)
async def search_best_plate(
    plate: str,
    admin: CurrentUser = Depends(get_current_admin)
):
    """Get the best (highest confidence) detection for a plate (admin only)."""
    supabase = get_supabase_admin()

    result = supabase.table("plate_detections").select("*").eq(
        "plate", plate
    ).order("ocr_confidence", desc=True).limit(1).execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Plate not found")

    return PlateDetectionSchema(**result.data[0])


@router.delete("/{id}", status_code=204)
async def delete_plate(
    id: int,
    admin: CurrentUser = Depends(get_current_admin)
):
    """Delete a plate detection (admin only)."""
    supabase = get_supabase_admin()

    # Check if exists
    existing = supabase.table("plate_detections").select("id").eq("id", id).execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Plate not found")

    # Delete (cascade will handle gov_plate_numb)
    supabase.table("plate_detections").delete().eq("id", id).execute()

    return Response(status_code=204)


@router.put("/{id}", response_model=PlateResponse)
async def update_plate(
    id: int,
    updated: PlateUpdate,
    admin: CurrentUser = Depends(get_current_admin)
):
    """Update a plate detection (admin only)."""
    supabase = get_supabase_admin()

    # Check if exists
    existing = supabase.table("plate_detections").select("*").eq("id", id).single().execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Plate not found")

    # Build update data
    update_data = {k: v for k, v in updated.model_dump().items() if v is not None}

    if not update_data:
        return PlateResponse(**existing.data)

    result = supabase.table("plate_detections").update(update_data).eq("id", id).execute()

    return PlateResponse(**result.data[0])


@router.get("/session/{session_id}", response_model=List[PlateDetectionSchema])
async def get_plates_by_session(
    session_id: str,
    admin: CurrentUser = Depends(get_current_admin)
):
    """Get all plate detections for a session (admin only)."""
    supabase = get_supabase_admin()

    result = supabase.table("plate_detections").select("*").eq(
        "session_id", session_id
    ).order("timestamp", desc=True).execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="No detections found for this session")

    # Get gov plates for each detection
    detections = []
    for plate in result.data:
        gov_plate = supabase.table("gov_plate_numb").select("*").eq(
            "detection_id", plate["id"]
        ).execute()

        if gov_plate.data:
            plate["govplate"] = gov_plate.data[0]

        detections.append(PlateDetectionSchema(**plate))

    return detections
