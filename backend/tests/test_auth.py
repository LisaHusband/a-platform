import jwt
import pytest

from app import auth as auth_mod
from app.auth import (
    create_token,
    hash_password,
    require_role,
    verify_password,
)


def test_health(client):
    res = client.get("/api/v1/health")
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "ok"
    assert body["indexed_docs"] >= 1
    assert body["dependencies"]["database"] == "ok"
    assert body["dependencies"]["search_index"] == "ok"
    assert "version" in body


def test_version(client):
    res = client.get("/api/v1/version")
    assert res.status_code == 200
    assert res.json()["name"] == "A-PLATFORM"
    assert res.json()["version"]


def test_password_hash_roundtrip():
    h = hash_password("s3cretpw")
    assert "$" in h
    assert verify_password("s3cretpw", h)
    assert not verify_password("wrong", h)


def test_register_login_me(client):
    res = client.post(
        "/api/v1/auth/register",
        json={"email": "new@a.dev", "name": "新用户", "password": "password123"},
    )
    assert res.status_code == 200
    token = res.json()["token"]
    assert res.json()["user"]["role"] == "reader"

    me = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200
    assert me.json()["email"] == "new@a.dev"


def test_register_duplicate_email(client):
    res = client.post(
        "/api/v1/auth/register",
        json={"email": "reader@a.dev", "name": "dup", "password": "password123"},
    )
    assert res.status_code == 409


def test_login_wrong_password(client):
    res = client.post(
        "/api/v1/auth/login", json={"email": "reader@a.dev", "password": "nope1234"}
    )
    assert res.status_code == 401


def test_login_unknown_user(client):
    res = client.post(
        "/api/v1/auth/login", json={"email": "ghost@a.dev", "password": "password123"}
    )
    assert res.status_code == 401


def test_me_requires_auth(client):
    assert client.get("/api/v1/auth/me").status_code == 401


def test_me_rejects_garbage_token(client):
    res = client.get("/api/v1/auth/me", headers={"Authorization": "Bearer not.a.jwt"})
    assert res.status_code == 401


def test_me_rejects_expired_token(client, db):
    from app.models import User

    user = db.query(User).filter(User.email == "reader@a.dev").first()
    expired = jwt.encode(
        {"sub": str(user.id), "role": user.role, "exp": 1},
        auth_mod.SECRET,
        algorithm=auth_mod.ALGO,
    )
    res = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {expired}"})
    assert res.status_code == 401


def test_create_token_contains_claims(db):
    from app.models import User

    user = db.query(User).filter(User.email == "admin@a.dev").first()
    token = create_token(user)
    payload = jwt.decode(token, auth_mod.SECRET, algorithms=[auth_mod.ALGO])
    assert payload["sub"] == str(user.id)
    assert payload["role"] == "admin"


def test_require_role_admin_passes_any():
    from app.models import User

    checker = require_role("editor")
    admin = User(role="admin")
    assert checker(admin) is admin


def test_require_role_rejects_wrong_role():
    from fastapi import HTTPException

    from app.models import User

    checker = require_role("editor")
    with pytest.raises(HTTPException) as exc:
        checker(User(role="reader"))
    assert exc.value.status_code == 403
