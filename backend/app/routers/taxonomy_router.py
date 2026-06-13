from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Category, Tag, Topic
from ..schemas import CategoryOut, NamedOut, TopicOut

router = APIRouter(prefix="/taxonomy", tags=["taxonomy"])


@router.get("/categories", response_model=list[CategoryOut])
def categories(db: Session = Depends(get_db)):
    return db.query(Category).order_by(Category.id).all()


@router.get("/tags", response_model=list[NamedOut])
def tags(db: Session = Depends(get_db)):
    return db.query(Tag).order_by(Tag.slug).all()


@router.get("/topics", response_model=list[TopicOut])
def topics(db: Session = Depends(get_db)):
    return db.query(Topic).order_by(Topic.slug).all()
