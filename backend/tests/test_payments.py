def test_wallet_default_balance(client, reader_headers):
    res = client.get("/api/v1/payments/wallet", headers=reader_headers)
    assert res.status_code == 200
    assert res.json()["balance"] == 1000.0
    assert res.json()["currency"] == "CNY"


def test_methods(client):
    body = client.get("/api/v1/payments/methods").json()
    assert {m["id"] for m in body["methods"]} == {"balance", "alipay", "paypal"}
    assert body["pricing"]["monthly"] > 0


def test_balance_payment_grants_and_deducts(client, reader_headers):
    res = client.post(
        "/api/v1/payments",
        headers=reader_headers,
        json={"kind": "content", "ref": "1", "method": "balance"},
    )
    assert res.status_code == 200
    order = res.json()["order"]
    assert order["status"] == "paid"
    assert res.json()["approval_url"] is None
    # balance reduced by content price (12)
    assert client.get("/api/v1/payments/wallet", headers=reader_headers).json()["balance"] == 988.0
    # access granted
    assert client.get("/api/v1/contents/1", headers=reader_headers).json()["has_access"] is True


def test_alipay_sandbox_flow(client, reader_headers):
    res = client.post(
        "/api/v1/payments",
        headers=reader_headers,
        json={"kind": "content", "ref": "1", "method": "alipay"},
    )
    body = res.json()
    assert body["order"]["status"] == "created"
    assert body["approval_url"].startswith("https://sandbox.alipay")
    assert body["qr_code"]  # alipay returns a QR payload
    order_id = body["order"]["id"]
    # not yet granted
    assert client.get("/api/v1/contents/1", headers=reader_headers).json()["has_access"] is False
    # confirm callback
    conf = client.post(f"/api/v1/payments/{order_id}/confirm", headers=reader_headers)
    assert conf.json()["status"] == "paid"
    assert client.get("/api/v1/contents/1", headers=reader_headers).json()["has_access"] is True


def test_paypal_no_qr(client, reader_headers):
    body = client.post(
        "/api/v1/payments",
        headers=reader_headers,
        json={"kind": "subscription", "ref": "monthly", "method": "paypal"},
    ).json()
    assert body["approval_url"].startswith("https://sandbox.paypal")
    assert body["qr_code"] is None


def test_confirm_failure_marks_failed(client, reader_headers):
    body = client.post(
        "/api/v1/payments",
        headers=reader_headers,
        json={"kind": "content", "ref": "1", "method": "alipay"},
    ).json()
    oid = body["order"]["id"]
    conf = client.post(
        f"/api/v1/payments/{oid}/confirm", headers=reader_headers, params={"outcome": "fail"}
    )
    assert conf.json()["status"] == "failed"
    assert client.get("/api/v1/contents/1", headers=reader_headers).json()["has_access"] is False


def test_insufficient_balance(client, reader_headers, db):
    from app.models import User

    user = db.query(User).filter(User.email == "reader@a.dev").first()
    user.balance = 1.0
    db.commit()
    res = client.post(
        "/api/v1/payments",
        headers=reader_headers,
        json={"kind": "content", "ref": "1", "method": "balance"},
    )
    assert res.status_code == 402


def test_subscription_balance_payment(client, author_headers):
    res = client.post(
        "/api/v1/payments",
        headers=author_headers,
        json={"kind": "subscription", "ref": "topic:ai-infra", "method": "balance"},
    )
    assert res.status_code == 200
    subs = client.get("/api/v1/billing/subscriptions", headers=author_headers).json()
    assert any(s["plan"] == "topic" for s in subs)


def test_payment_unknown_topic(client, reader_headers):
    res = client.post(
        "/api/v1/payments",
        headers=reader_headers,
        json={"kind": "subscription", "ref": "topic:ghost", "method": "balance"},
    )
    assert res.status_code == 404


def test_payment_bad_method(client, reader_headers):
    res = client.post(
        "/api/v1/payments",
        headers=reader_headers,
        json={"kind": "content", "ref": "1", "method": "bitcoin"},
    )
    assert res.status_code == 400


def test_confirm_balance_order_idempotent(client, reader_headers):
    # balance orders are settled instantly; confirming returns paid (idempotent)
    body = client.post(
        "/api/v1/payments",
        headers=reader_headers,
        json={"kind": "content", "ref": "1", "method": "balance"},
    ).json()
    res = client.post(f"/api/v1/payments/{body['order']['id']}/confirm", headers=reader_headers)
    assert res.status_code == 200
    assert res.json()["status"] == "paid"


def test_confirm_not_your_order(client, reader_headers, author_headers):
    oid = client.post(
        "/api/v1/payments",
        headers=reader_headers,
        json={"kind": "content", "ref": "1", "method": "alipay"},
    ).json()["order"]["id"]
    res = client.post(f"/api/v1/payments/{oid}/confirm", headers=author_headers)
    assert res.status_code == 403


def test_confirm_twice_after_fail_conflict(client, reader_headers):
    oid = client.post(
        "/api/v1/payments",
        headers=reader_headers,
        json={"kind": "content", "ref": "1", "method": "paypal"},
    ).json()["order"]["id"]
    client.post(
        f"/api/v1/payments/{oid}/confirm", headers=reader_headers, params={"outcome": "fail"}
    )
    again = client.post(f"/api/v1/payments/{oid}/confirm", headers=reader_headers)
    assert again.status_code == 409


def test_payment_invalid_content_ref(client, reader_headers):
    res = client.post(
        "/api/v1/payments",
        headers=reader_headers,
        json={"kind": "content", "ref": "abc", "method": "balance"},
    )
    assert res.status_code == 400


def test_confirm_missing_order(client, reader_headers):
    assert client.post("/api/v1/payments/9999/confirm", headers=reader_headers).status_code == 404


def test_list_orders(client, reader_headers):
    client.post(
        "/api/v1/payments",
        headers=reader_headers,
        json={"kind": "content", "ref": "1", "method": "alipay"},
    )
    orders = client.get("/api/v1/payments", headers=reader_headers).json()
    assert len(orders) >= 1


def test_billing_purchase_uses_balance(client, reader_headers):
    client.post("/api/v1/billing/purchase/1", headers=reader_headers)
    assert client.get("/api/v1/payments/wallet", headers=reader_headers).json()["balance"] == 988.0


def test_wallet_requires_auth(client):
    assert client.get("/api/v1/payments/wallet").status_code == 401
