from sqlalchemy import Boolean, Column, ForeignKey, Integer, String, Float, DateTime
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from sqlalchemy.sql.expression import text
from app.db.database import Base
from sqlalchemy.sql.sqltypes import TIMESTAMP

class PlateDetection(Base):
    __tablename__ = "plate_detections"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String, index=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    plate = Column(String, index=True)
    ocr_confidence = Column(Float)
    detection_confidence = Column(Float)

    govplate = relationship("GovPlate", back_populates="detection", uselist=False)


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
    is_admin = Column(Boolean, default=False)
    created_at = Column(TIMESTAMP(timezone=True),
                        nullable=False, server_default=text('now()'))
    
