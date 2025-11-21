from fastapi import  status, HTTPException, Depends, APIRouter
from sqlalchemy.orm import Session
from app.db import models, schema
from app.security import get_current_admin
from app.utils import hash_password
from app.db.database import get_db

router = APIRouter(prefix="/users", tags=["Users"])


@router.post("/", status_code=status.HTTP_201_CREATED, response_model=schema.UserResponse)
def create_user(user: schema.UserCreate, db: Session = Depends(get_db)):

    existing = db.query(models.User).filter(models.User.username == user.username).first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail="Username already registered"
        )

    hashed_pw = hash_password(user.password)

    new_user = models.User(
        username=user.username,
        password=hashed_pw
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return new_user

@router.post("/admin", status_code=status.HTTP_201_CREATED, response_model=schema.UserResponse)
def create_user_admin(
    user: schema.UserCreate,
    is_admin: bool = False,  
    db: Session = Depends(get_db),
    admin: models.User = Depends(get_current_admin)
):

    existing = db.query(models.User).filter(models.User.username == user.username).first()
    if existing:
        raise HTTPException(status_code=400, detail="Username already registered")

    hashed_pw = hash_password(user.password)
    new_user = models.User(username=user.username, password=hashed_pw, is_admin=is_admin)

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return new_user