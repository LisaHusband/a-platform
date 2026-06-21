from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..database import get_db
from ..models import Purchase, Subscription, User
from ..schemas import PurchaseOut, SubscribeIn, SubscriptionOut
from ..services import payments

router = APIRouter(prefix="/billing", tags=["billing"])


@router.post("/purchase/{content_id}", response_model=PurchaseOut)
def purchase(
    content_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """便捷购买（钱包余额结算）/ quick purchase settled from the wallet balance.

    第三方支付（支付宝 / PayPal）走 /payments 流程 / third-party flows use /payments.
    """
    existing = (
        db.query(Purchase)
        .filter(Purchase.user_id == user.id, Purchase.content_id == content_id)
        .first()
    )
    if existing:
        return existing
    try:
        payments.create_order(db, user, "content", str(content_id), "balance")
    except payments.PaymentError as exc:
        raise HTTPException(exc.status, exc.detail) from exc
    db.commit()
    return (
        db.query(Purchase)
        .filter(Purchase.user_id == user.id, Purchase.content_id == content_id)
        .first()
    )


@router.post("/subscribe", response_model=SubscriptionOut)
def subscribe(
    data: SubscribeIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """便捷订阅（钱包余额结算）/ quick subscribe settled from the wallet balance."""
    if data.plan == "topic":
        if not data.topic_slug:
            raise HTTPException(400, "topic_slug required for topic plan")
        ref = f"topic:{data.topic_slug}"
    elif data.plan == "monthly":
        ref = "monthly"
    else:
        raise HTTPException(400, "plan must be monthly|topic")
    try:
        order, _, _ = payments.create_order(db, user, "subscription", ref, "balance")
    except payments.PaymentError as exc:
        raise HTTPException(exc.status, exc.detail) from exc
    sub = (
        db.query(Subscription)
        .filter(Subscription.user_id == user.id)
        .order_by(Subscription.id.desc())
        .first()
    )
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
    return {
        "monthly": payments.MONTHLY_PRICE,
        "topic": payments.TOPIC_PRICE,
        "currency": "CNY",
    }
