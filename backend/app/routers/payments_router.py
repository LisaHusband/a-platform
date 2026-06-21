from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..database import get_db
from ..models import PaymentOrder, User
from ..schemas import (
    PaymentCreateIn,
    PaymentCreateOut,
    PaymentOrderOut,
    WalletOut,
)
from ..services import payments

router = APIRouter(prefix="/payments", tags=["payments"])


@router.get("/wallet", response_model=WalletOut)
def wallet(user: User = Depends(get_current_user)):
    return WalletOut(balance=round(user.balance, 2))


@router.get("/methods")
def methods():
    """可用支付方式 / available payment methods."""
    return {
        "methods": [
            {"id": "balance", "label_zh": "余额支付", "label_en": "Wallet balance"},
            {"id": "alipay", "label_zh": "支付宝（沙箱）", "label_en": "Alipay (sandbox)"},
            {"id": "paypal", "label_zh": "PayPal（沙箱）", "label_en": "PayPal (sandbox)"},
        ],
        "pricing": {"monthly": payments.MONTHLY_PRICE, "topic": payments.TOPIC_PRICE},
    }


@router.post("", response_model=PaymentCreateOut)
def create_payment(
    data: PaymentCreateIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    try:
        order, approval, qr = payments.create_order(db, user, data.kind, data.ref, data.method)
    except payments.PaymentError as exc:
        raise HTTPException(exc.status, exc.detail) from exc
    db.commit()
    return PaymentCreateOut(
        order=PaymentOrderOut.model_validate(order), approval_url=approval, qr_code=qr
    )


@router.post("/{order_id}/confirm", response_model=PaymentOrderOut)
def confirm_payment(
    order_id: int,
    outcome: str = Query("success", pattern="^(success|fail)$"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    order = db.get(PaymentOrder, order_id)
    if not order:
        raise HTTPException(404, "Order not found")
    try:
        payments.confirm_order(db, user, order, success=(outcome == "success"))
    except payments.PaymentError as exc:
        raise HTTPException(exc.status, exc.detail) from exc
    db.commit()
    return order


@router.get("", response_model=list[PaymentOrderOut])
def list_orders(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return (
        db.query(PaymentOrder)
        .filter(PaymentOrder.user_id == user.id)
        .order_by(PaymentOrder.id.desc())
        .all()
    )
