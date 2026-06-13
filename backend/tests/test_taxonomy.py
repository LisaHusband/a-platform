def test_categories(client):
    cats = client.get("/api/v1/taxonomy/categories").json()
    slugs = {c["slug"] for c in cats}
    assert {"tech", "finance", "ai-systems", "semiconductor"} <= slugs
    # children carry parent_id
    assert any(c["parent_id"] for c in cats)


def test_tags(client):
    tags = client.get("/api/v1/taxonomy/tags").json()
    assert {"llm", "consensus", "euv"} <= {t["slug"] for t in tags}


def test_topics(client):
    topics = client.get("/api/v1/taxonomy/topics").json()
    by_slug = {t["slug"]: t for t in topics}
    assert "ai-infra" in by_slug
    assert by_slug["ai-infra"]["description_zh"]
