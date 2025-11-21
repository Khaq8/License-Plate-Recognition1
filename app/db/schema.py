from pydantic import BaseModel, Field, constr
from datetime import datetime
from typing import Annotated, Optional

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

class UserCreate(BaseModel):
    username: str
    password: str


class UserResponse(BaseModel):
    id: int
    username: str
    created_at: datetime

    class Config:
        from_attributes = True