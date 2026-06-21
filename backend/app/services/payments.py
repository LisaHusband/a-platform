"""支付与履约逻辑 / payment quoting and fulfillment.

沙箱实现：`balance` 即时扣减钱包；`alipay` / `paypal` 模拟「创建订单 → 第三方
跳转 → 回调确认」流程，不接入真实网关。金额单位与内容定价一致（元）。
Sandbox: `balance` deducts the wallet instantly; `alipay`/`paypal` simulate the
create → redirect → callback flow without a real gateway. Amounts are in the
same unit as content pricing (RMB).
"""

from __future__ import annotations

from datetime import timedelta

from sqlalchemy.orm import Session

from ..models import Content, PaymentOrder, Purchase, Subscription, Topic, User, utcnow

MONTHLY_PRICE = 30.0
TOPIC_PRICE = 12.0
SUBSCRIPTION_DAYS = 30
METHODS = ("balance", "alipay", "paypal")


class PaymentError(Exception):
    """携带 HTTP 状态码的支付错误 / payment error carrying an HTTP status."""

    def __init__(self, status: int, detail: str):
        super().__init__(detail)
        self.status = status
        self.detail = detail


def quote(db: Session, kind: str, ref: str) -> float:
    """计算应付金额并校验目标 / resolve the amount and validate the target."""
    if kind == "content":
        try:
            content_id = int(ref)
        except ValueError as exc:
            raise PaymentError(400, "Invalid content reference") from exc
        content = (
            db.query(Content)
            .filter(Content.id == content_id, Content.status == "published")
            .first()
        )
        if not content:
            raise PaymentError(404, "Content not found")
        if not content.is_standalone_purchase:
            raise PaymentError(409, "Subscription-only content")
        return content.price
    if kind == "subscription":
        if ref == "monthly":
            return MONTHLY_PRICE
        if ref.startswith("topic:"):
            slug = ref.split(":", 1)[1]
            if not db.query(Topic).filter(Topic.slug == slug).first():
                raise PaymentError(404, "Unknown topic")
            return TOPIC_PRICE
        raise PaymentError(400, "Invalid subscription reference")
    raise PaymentError(400, "Unknown payment kind")


def grant(db: Session, user: User, kind: str, ref: str, amount: float):
    """发放权益（幂等）/ grant the entitlement (idempotent)."""
    if kind == "content":
        content_id = int(ref)
        existing = (
            db.query(Purchase)
            .filter(Purchase.user_id == user.id, Purchase.content_id == content_id)
            .first()
        )
        if existing:
            return existing
        purchase = Purchase(user_id=user.id, content_id=content_id, price_paid=amount)
        db.add(purchase)
        db.flush()
        return purchase
    # subscription
    topic_id = None
    plan = "monthly"
    if ref.startswith("topic:"):
        plan = "topic"
        topic = db.query(Topic).filter(Topic.slug == ref.split(":", 1)[1]).first()
        topic_id = topic.id if topic else None
    sub = Subscription(
        user_id=user.id,
        plan=plan,
        topic_id=topic_id,
        expires_at=utcnow() + timedelta(days=SUBSCRIPTION_DAYS),
    )
    db.add(sub)
    db.flush()
    return sub


def create_order(
    db: Session, user: User, kind: str, ref: str, method: str
) -> tuple[PaymentOrder, str | None, str | None]:
    """创建订单；balance 立即支付并发放，第三方返回沙箱跳转信息。

    Create an order; `balance` pays + grants immediately, third parties return
    a sandbox approval URL (and QR for Alipay). Returns (order, approval_url, qr).
    """
    if method not in METHODS:
        raise PaymentError(400, "Unsupported payment method")
    amount = quote(db, kind, ref)
    order = PaymentOrder(
        user_id=user.id, kind=kind, ref=ref, amount=amount, method=method, status="created"
    )
    db.add(order)
    db.flush()

    if method == "balance":
        if user.balance < amount:
            raise PaymentError(402, "Insufficient balance")
        user.balance -= amount
        order.status = "paid"
        order.provider_txn = f"wallet_{order.id}"
        grant(db, user, kind, ref, amount)
        return order, None, None

    # alipay / paypal sandbox
    order.provider_txn = f"{method}_sandbox_{order.id}"
    approval = (
        f"https://sandbox.{method}.example/checkout?order={order.id}"
        f"&token={order.provider_txn}"
    )
    qr = approval if method == "alipay" else None
    return order, approval, qr


def confirm_order(db: Session, user: User, order: PaymentOrder, success: bool) -> PaymentOrder:
    """模拟第三方回调 / simulate the provider callback for a pending order."""
    if order.user_id != user.id:
        raise PaymentError(403, "Not your order")
    if order.status == "paid":
        return order  # idempotent (covers instantly-settled balance orders)
    if order.status != "created":
        raise PaymentError(409, f"Cannot confirm a '{order.status}' order")
    if not success:
        order.status = "failed"
        return order
    order.status = "paid"
    grant(db, user, order.kind, order.ref, order.amount)
    return order
