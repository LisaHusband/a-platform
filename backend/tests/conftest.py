"""Shared test fixtures.

Points the app at a throwaway SQLite file (via APLATFORM_DB, honored by
app.database) and reseeds a fresh database before every test so tests are fully
isolated and order-independent.
"""

import os
import tempfile

# Must be set before importing anything that touches app.database.
_DB_FD, _DB_PATH = tempfile.mkstemp(suffix=".db", prefix="aplatform_test_")
os.close(_DB_FD)
os.environ["APLATFORM_DB"] = _DB_PATH

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.database import Base, SessionLocal, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.seed import seed_if_empty  # noqa: E402
from app.services.search_engine import INDEX  # noqa: E402


@pytest.fixture(autouse=True)
def fresh_db():
    """Drop, recreate and reseed the database + search index per test."""
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    db = SessionLocal()
    try:
        seed_if_empty(db)
        INDEX.rebuild(db)
    finally:
        db.close()
    yield


@pytest.fixture()
def client():
    return TestClient(app)


@pytest.fixture()
def db():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


def login(client: TestClient, email: str, password: str = "password123") -> str:
    res = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert res.status_code == 200, res.text
    return res.json()["token"]


def auth_header(client: TestClient, email: str) -> dict:
    return {"Authorization": f"Bearer {login(client, email)}"}


@pytest.fixture()
def reader_headers(client):
    return auth_header(client, "reader@a.dev")


@pytest.fixture()
def author_headers(client):
    return auth_header(client, "author@a.dev")


@pytest.fixture()
def editor_headers(client):
    return auth_header(client, "editor@a.dev")


@pytest.fixture()
def expert_headers(client):
    return auth_header(client, "expert@a.dev")


@pytest.fixture()
def admin_headers(client):
    return auth_header(client, "admin@a.dev")


def pytest_sessionfinish(session, exitstatus):
    try:
        os.unlink(_DB_PATH)
    except OSError:
        pass
