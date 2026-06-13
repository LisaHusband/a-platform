from app.seed import seed_if_empty


def test_sitemap_xml(client):
    res = client.get("/sitemap.xml")
    assert res.status_code == 200
    assert "application/xml" in res.headers["content-type"]
    body = res.text
    assert "https://www.a-platform.tech/" in body
    assert "/content/1" in body  # published content included
    assert "/content/8" not in body  # pending draft excluded
    assert "<lastmod>" in body


def test_seed_is_idempotent(db):
    # DB already seeded by fixture; calling again must be a no-op (early return)
    before = db.execute  # sanity ref
    seed_if_empty(db)
    from app.models import User

    assert db.query(User).count() == 5
    assert before is not None
