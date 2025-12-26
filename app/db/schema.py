from pydantic import BaseModel, Field, constr
from datetime import datetime
from typing import Annotated, Optional, List
from decimal import Decimal
from enum import Enum


class TransactionTypeEnum(str, Enum):
    PAYMENT = "payment"
    TOP_UP = "top_up"
    REFUND = "refund"
    PENALTY = "penalty"


class GovPlateSchema(BaseModel):
    id: int
    gov_plate_numb: str
    plate: str

    class Config:
        from_attributes = True


class PlateDetectionSchema(BaseModel):
    id: int
    session_id: str
    timestamp: datetime
    plate: str
    ocr_confidence: float
    detection_confidence: float
    govplate: Optional[GovPlateSchema]

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    id: Optional[int] = None
    is_admin: Optional[bool] = False

# ============== User Schemas ==============

class UserCreate(BaseModel):
    username: str
    password: str
    email: Optional[str] = None
    full_name: Optional[str] = None


class UserResponse(BaseModel):
    id: int
    username: str
    email: Optional[str]
    full_name: Optional[str]
    is_admin: bool
    credit_balance: Decimal
    created_at: datetime

    class Config:
        from_attributes = True


# ============== Car Schemas ==============

class CarCreate(BaseModel):
    license_plate: constr(min_length=2, max_length=15)
    brand: Optional[str] = None
    model: Optional[str] = None
    color: Optional[str] = None
    is_primary: bool = False


class CarResponse(BaseModel):
    id: int
    user_id: int
    license_plate: str
    brand: Optional[str]
    model: Optional[str]
    color: Optional[str]
    is_primary: bool
    created_at: datetime

    class Config:
        from_attributes = True


# ============== Parking Lot Schemas ==============

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

    class Config:
        from_attributes = True


class ParkingLotStatus(BaseModel):
    lot_id: int
    name: str
    capacity: int
    current_occupancy: int
    available_spots: int
    occupancy_percentage: float


# ============== Parking Session Schemas ==============

class ParkingSessionCreate(BaseModel):
    plate: constr(min_length=2, max_length=15)
    entry_confidence: Optional[float] = None
    entry_image_url: Optional[str] = None


class ParkingSessionResponse(BaseModel):
    id: int
    lot_id: int
    plate: str
    car_id: Optional[int]
    user_id: Optional[int]
    entry_time: datetime
    exit_time: Optional[datetime]
    entry_image_url: Optional[str]
    exit_image_url: Optional[str]
    duration_minutes: Optional[int]
    amount_charged: Optional[Decimal]
    status: str
    is_force_checkout: bool
    created_at: datetime

    class Config:
        from_attributes = True


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


# ============== Transaction Schemas ==============

class TransactionResponse(BaseModel):
    id: int
    user_id: int
    session_id: Optional[int]
    type: str
    amount: Decimal
    balance_after: Decimal
    description: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


# ============== Admin/User Management Schemas ==============

class UserWithDetails(BaseModel):
    id: int
    username: str
    email: Optional[str]
    full_name: Optional[str]
    is_admin: bool
    credit_balance: Decimal
    phone: Optional[str]
    created_at: datetime
    cars_count: int = 0
    active_sessions_count: int = 0

    class Config:
        from_attributes = True


class UserListFilters(BaseModel):
    search: Optional[str] = None
    has_active_session: Optional[bool] = None
    lot_id: Optional[int] = None


class ActiveUserInLot(BaseModel):
    user_id: Optional[int]
    username: Optional[str]
    plate: str
    car_brand: Optional[str]
    entry_time: datetime
    duration_minutes: int
    estimated_charge: Decimal
    session_id: int


class PlateListSchema(BaseModel):
    id: int
    plate: str
    timestamp: datetime
    gov_plate_numb: Optional[str] = None

    class Config:
        from_attributes = True


class PlateUpdate(BaseModel):
    session_id: Optional[str] = None
    plate: Optional[str] = None
    ocr_confidence: Optional[float] = None
    detection_confidence: Optional[float] = None


class PlateResponse(BaseModel):
    id: int
    session_id: str
    timestamp: datetime
    plate: str
    ocr_confidence: float
    detection_confidence: float

    class Config:
        from_attributes = True