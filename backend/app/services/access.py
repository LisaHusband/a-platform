"""Paywall: full body is visible to the author, editors/admins, buyers,
active full subscribers, or active topic subscribers of any of its topics."""

from datetime import UTC, datetime

from sqlalchemy.orm import Session

from ..models import Content, Purchase, Subscription, User


def has_access(db: Session, user: User | None, content: Content) -> bool:
    if content.price == 0 and not content.is_standalone_purchase:
        return True
    if user is None:
        return False
    if user.role in ("editor", "expert", "admin") or content.author_id == user.id:
        return True
    if (
        db.query(Purchase)
        .filter(Purchase.user_id == user.id, Purchase.content_id == content.id)
        .first()
    ):
        return True
    now = datetime.now(UTC)
    topic_ids = {t.id for t in content.topics}
    for sub in db.query(Subscription).filter(Subscription.user_id == user.id).all():
        expires = sub.expires_at
        if expires.tzinfo is None:
            expires = expires.replace(tzinfo=UTC)
        if expires < now:
            continue
        if sub.plan == "monthly":
            return True
        if sub.plan == "topic" and sub.topic_id in topic_ids:
            return True
    return False
