from datetime import UTC, datetime, timedelta

from app.models import Content, Subscription, User
from app.services.access import has_access


def test_pricing(client):
    p = client.get("/api/v1/billing/pricing").json()
    assert p["monthly"] > 0 and p["topic"] > 0 and p["currency"] == "USD"


def test_purchase_then_access(client, reader_headers):
    res = client.post("/api/v1/billing/purchase/1", headers=reader_headers)
    assert res.status_code == 200
    assert res.json()["price_paid"] == 12.0
    detail = client.get("/api/v1/contents/1", headers=reader_headers).json()
    assert detail["has_access"] is True


def test_purchase_idempotent(client, reader_headers):
    first = client.post("/api/v1/billing/purchase/1", headers=reader_headers).json()
    second = client.post("/api/v1/billing/purchase/1", headers=reader_headers).json()
    assert first["id"] == second["id"]


def test_purchase_missing_content_404(client, reader_headers):
    assert client.post("/api/v1/billing/purchase/9999", headers=reader_headers).status_code == 404


def test_purchase_subscription_only_conflict(client, reader_headers):
    # c4 has is_standalone_purchase=0
    assert client.post("/api/v1/billing/purchase/4", headers=reader_headers).status_code == 409


def test_purchase_requires_auth(client):
    assert client.post("/api/v1/billing/purchase/1").status_code == 401


def test_subscribe_monthly(client, reader_headers):
    res = client.post(
        "/api/v1/billing/subscribe", headers=reader_headers, json={"plan": "monthly"}
    )
    assert res.status_code == 200
    assert res.json()["plan"] == "monthly"


def test_subscribe_topic(client, author_headers):
    res = client.post(
        "/api/v1/billing/subscribe",
        headers=author_headers,
        json={"plan": "topic", "topic_slug": "ai-infra"},
    )
    assert res.status_code == 200
    assert res.json()["topic"]["slug"] == "ai-infra"


def test_subscribe_topic_missing_slug(client, reader_headers):
    res = client.post("/api/v1/billing/subscribe", headers=reader_headers, json={"plan": "topic"})
    assert res.status_code == 400


def test_subscribe_unknown_topic(client, reader_headers):
    res = client.post(
        "/api/v1/billing/subscribe",
        headers=reader_headers,
        json={"plan": "topic", "topic_slug": "ghost"},
    )
    assert res.status_code == 404


def test_subscribe_invalid_plan(client, reader_headers):
    res = client.post(
        "/api/v1/billing/subscribe", headers=reader_headers, json={"plan": "weekly"}
    )
    assert res.status_code == 400


def test_list_purchases_and_subscriptions(client, reader_headers):
    client.post("/api/v1/billing/purchase/1", headers=reader_headers)
    assert len(client.get("/api/v1/billing/purchases", headers=reader_headers).json()) >= 1
    # reader is seeded with a trust-systems topic subscription
    assert len(client.get("/api/v1/billing/subscriptions", headers=reader_headers).json()) >= 1


# --- access.py direct unit coverage ---


def test_access_monthly_subscription(db):
    user = db.query(User).filter(User.email == "author@a.dev").first()
    content = db.get(Content, 1)
    db.add(
        Subscription(
            user_id=user.id,
            plan="monthly",
            expires_at=datetime.now(UTC) + timedelta(days=10),
        )
    )
    db.commit()
    assert has_access(db, user, content) is True


def test_access_expired_subscription_denied(db):
    # fresh reader-like user with only an expired sub
    user = User(email="exp@a.dev", name="exp", password_hash="x$y", role="reader")
    db.add(user)
    db.flush()
    db.add(
        Subscription(
            user_id=user.id,
            plan="monthly",
            expires_at=datetime.now(UTC) - timedelta(days=1),
        )
    )
    db.commit()
    content = db.get(Content, 1)
    assert has_access(db, user, content) is False


def test_access_anonymous_denied_for_paid(db):
    assert has_access(db, None, db.get(Content, 1)) is False


def test_access_author_sees_own(db):
    content = db.get(Content, 1)
    author = db.get(User, content.author_id)
    assert has_access(db, author, content) is True
