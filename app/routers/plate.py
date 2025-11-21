from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session,joinedload
from app.security import get_current_admin
from app.db.database import get_db
from app.db.models import GovPlate, PlateDetection ,User
from app.db.schema import PlateDetectionSchema, PlateListSchema ,PlateResponse,PlateUpdate

router = APIRouter(
    prefix="/plates",
    tags=["Plates"]
)

@router.get("/", response_model=list[PlateListSchema])
def get_all_plates(
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    results = (
        db.query(PlateDetection)
        .outerjoin(GovPlate)
        .add_columns(GovPlate.gov_plate_numb)
        .all()
    )

    output = []
    for plate, gov_num in results:
        output.append({
            "id": plate.id,
            "plate": plate.plate,
            "timestamp": plate.timestamp,
            "gov_plate_numb": gov_num
        })
    return output

@router.get("/id/{id}", response_model=PlateDetectionSchema)
def search_by_id(
    id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    result = db.query(PlateDetection).filter(PlateDetection.id == id).first()
    if not result:
        raise HTTPException(status_code=404, detail="Plate ID not found")
    return result

@router.get("/search/{plate}", response_model=list[PlateDetectionSchema])
def search_plate(
    plate: str,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    results = db.query(PlateDetection).filter(PlateDetection.plate == plate).all()
    if not results:
        raise HTTPException(status_code=404, detail="Plate not found")
    return results

@router.get("/search", response_model=list[PlateDetectionSchema])
def search_plate_partial(
    q: str,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    return db.query(PlateDetection).filter(PlateDetection.plate.ilike(f"%{q}%")).all()

@router.get("/search/{plate}/best", response_model=PlateDetectionSchema)
def search_best_plate(
    plate: str,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    result = (
        db.query(PlateDetection)
        .filter(PlateDetection.plate == plate)
        .order_by(PlateDetection.ocr_confidence.desc())
        .first()
    )
    if not result:
        raise HTTPException(status_code=404, detail="Plate not found")
    return result

@router.delete("/{id}", status_code=204)
def delete_plate(
    id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    query = db.query(PlateDetection).filter(PlateDetection.id == id)
    record = query.first()
    if not record:
        raise HTTPException(status_code=404, detail="Plate not found")
    query.delete(synchronize_session=False)
    db.commit()
    return Response(status_code=204)

@router.put("/{id}", response_model=PlateResponse)
def update_plate(
    id: int,
    updated: PlateUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    query = db.query(PlateDetection).filter(PlateDetection.id == id)
    record = query.first()
    if not record:
        raise HTTPException(status_code=404, detail="Plate not found")

    query.update(updated.dict(exclude_unset=True), synchronize_session=False)
    db.commit()
    return query.first()
@router.get("/session/{session_id}", response_model=list[PlateDetectionSchema])
def get_plates_by_session(
    session_id: str,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    records = (
        db.query(PlateDetection)
        .options(joinedload(PlateDetection.govplate))
        .filter(PlateDetection.session_id == session_id)
        .all()
    )

    if not records:
        raise HTTPException(status_code=404, detail="No detections found for this session")

    return records