from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..database import get_db
from ..models import Content, Purchase, Subscription, Topic, User
from ..schemas import PurchaseOut, SubscribeIn, SubscriptionOut

router = APIRouter(prefix="/billing", tags=["billing"])

MONTHLY_PRICE = 30.0
TOPIC_PRICE = 12.0


@router.post("/purchase/{content_id}", response_model=PurchaseOut)
def purchase(
    content_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    content = db.query(Content).filter(
        Content.id == content_id, Content.status == "published"
    ).first()
    if not content:
        raise HTTPException(404, "Content not found")
    if not content.is_standalone_purchase:
        raise HTTPException(409, "Subscription-only content")
    existing = db.query(Purchase).filter(
        Purchase.user_id == user.id, Purchase.content_id == content_id
    ).first()
    if existing:
        return existing
    # Payment gateway intentionally mocked: charge succeeds immediately.
    p = Purchase(user_id=user.id, content_id=content_id, price_paid=content.price)
    db.add(p)
    db.commit()
    return p


@router.post("/subscribe", response_model=SubscriptionOut)
def subscribe(
    data: SubscribeIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    topic = None
    if data.plan == "topic":
        if not data.topic_slug:
            raise HTTPException(400, "topic_slug required for topic plan")
        topic = db.query(Topic).filter(Topic.slug == data.topic_slug).first()
        if not topic:
            raise HTTPException(404, "Unknown topic")
    elif data.plan != "monthly":
        raise HTTPException(400, "plan must be monthly|topic")
    sub = Subscription(
        user_id=user.id,
        plan=data.plan,
        topic_id=topic.id if topic else None,
        expires_at=datetime.now(UTC) + timedelta(days=30),
    )
    db.add(sub)
    db.commit()
    return sub


@router.get("/purchases", response_model=list[PurchaseOut])
def my_purchases(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return db.query(Purchase).filter(Purchase.user_id == user.id).all()


@router.get("/subscriptions", response_model=list[SubscriptionOut])
def my_subscriptions(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return db.query(Subscription).filter(Subscription.user_id == user.id).all()


@router.get("/pricing")
def pricing():
    return {"monthly": MONTHLY_PRICE, "topic": TOPIC_PRICE, "currency": "USD"}
