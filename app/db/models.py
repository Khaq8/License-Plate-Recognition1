from sqlalchemy import Boolean, Column, ForeignKey, Integer, String, Float, DateTime, Numeric, Enum, Text
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from sqlalchemy.sql.expression import text
from app.db.database import Base
from sqlalchemy.sql.sqltypes import TIMESTAMP
import enum


class TransactionType(str, enum.Enum):
    PAYMENT = "payment"
    TOP_UP = "top_up"
    REFUND = "refund"
    PENALTY = "penalty"


class ParkingLot(Base):
    __tablename__ = "parking_lots"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, unique=True)
    address = Column(String, nullable=True)
    city = Column(String, nullable=True)
    capacity = Column(Integer, nullable=False)
    hourly_rate = Column(Numeric(10, 2), nullable=False, default=1.00)
    is_active = Column(Boolean, default=True)
    created_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=text('now()'))

    # Relationships
    sessions = relationship("ParkingSession", back_populates="lot")
    detections = relationship("PlateDetection", back_populates="lot")


class PlateDetection(Base):
    __tablename__ = "plate_detections"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String, index=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    plate = Column(String, index=True)
    ocr_confidence = Column(Float)
    detection_confidence = Column(Float)
    lot_id = Column(Integer, ForeignKey("parking_lots.id"), nullable=True)

    govplate = relationship("GovPlate", back_populates="detection", uselist=False)
    lot = relationship("ParkingLot", back_populates="detections")


class GovPlate(Base):
    __tablename__ = "gov_plate_numb"

    id = Column(Integer, primary_key=True, index=True)
    gov_plate_numb = Column(String, index=True)
    plate = Column(String, index=True)
    detection_id = Column(Integer, ForeignKey("plate_detections.id"))

    detection = relationship("PlateDetection", back_populates="govplate")


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, nullable=False)
    username = Column(String, nullable=False, unique=True)
    password = Column(String, nullable=False)
    email = Column(String, nullable=True, unique=True)
    full_name = Column(String, nullable=True)
    is_admin = Column(Boolean, default=False) # All admins are Super Admins now
    credit_balance = Column(Numeric(10, 2), default=0.00)
    phone = Column(String, nullable=True)
    created_at = Column(TIMESTAMP(timezone=True),
                        nullable=False, server_default=text('now()'))

    # Relationships
    cars = relationship("Car", back_populates="user")
    parking_sessions = relationship("ParkingSession", back_populates="user")
    transactions = relationship("Transaction", back_populates="user")


class Car(Base):
    __tablename__ = "cars"
    id = Column(Integer, primary_key=True, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    license_plate = Column(String, nullable=False, unique=True, index=True)
    brand = Column(String, nullable=True)
    model = Column(String, nullable=True)
    color = Column(String, nullable=True)
    is_primary = Column(Boolean, default=False)
    created_at = Column(TIMESTAMP(timezone=True),
                        nullable=False, server_default=text('now()'))

    # Relationships
    user = relationship("User", back_populates="user")
    parking_sessions = relationship("ParkingSession", back_populates="car")


class ParkingSession(Base):
    __tablename__ = "parking_sessions"

    id = Column(Integer, primary_key=True, index=True)
    lot_id = Column(Integer, ForeignKey("parking_lots.id"), nullable=False)
    car_id = Column(Integer, ForeignKey("cars.id"), nullable=True) # Nullable for guest/unregistered
    plate = Column(String, nullable=False, index=True) # Redundant storage for history
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True) # Denormalized for convenience
    
    entry_time = Column(TIMESTAMP(timezone=True), nullable=False, server_default=text('now()'))
    exit_time = Column(TIMESTAMP(timezone=True), nullable=True)
    
    entry_image_url = Column(Text, nullable=True)
    exit_image_url = Column(Text, nullable=True)
    
    entry_confidence = Column(Float, nullable=True)
    exit_confidence = Column(Float, nullable=True)
    
    duration_minutes = Column(Integer, nullable=True)
    amount_charged = Column(Numeric(10, 2), nullable=True)
    
    status = Column(String, default='active') # active, completed
    is_force_checkout = Column(Boolean, default=False)
    created_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=text('now()'))

    # Relationships
    lot = relationship("ParkingLot", back_populates="sessions")
    car = relationship("Car", back_populates="parking_sessions")
    user = relationship("User", back_populates="parking_sessions")
    transactions = relationship("Transaction", back_populates="session")


class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    session_id = Column(Integer, ForeignKey("parking_sessions.id"), nullable=True) # Null for manual top-up
    
    type = Column(String, nullable=False) # payment, top_up, refund
    amount = Column(Numeric(10, 2), nullable=False) # Signed value
    balance_after = Column(Numeric(10, 2), nullable=False) # Snapshot
    description = Column(Text, nullable=True)
    
    created_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=text('now()'))

    # Relationships
    user = relationship("User", back_populates="transactions")
    session = relationship("ParkingSession", back_populates="transactions")
