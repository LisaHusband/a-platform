from app.services import crawler

HTML = "<html><head><title>抓取页标题</title></head><body><p>正文内容足够。</p></body></html>"


def fake_fetcher(url):
    if url.endswith("robots.txt"):
        return 200, "User-agent: *\nAllow: /\n"
    return 200, HTML


def disallow_fetcher(url):
    if url.endswith("robots.txt"):
        return 200, "User-agent: *\nDisallow: /\n"
    return 200, HTML


def test_sites_crud(client, editor_headers):
    # seeded demo site exists
    sites = client.get("/api/v1/crawl/sites", headers=editor_headers).json()
    assert any(s["domain"] == "example.com" for s in sites)
    # create
    res = client.post(
        "/api/v1/crawl/sites",
        headers=editor_headers,
        json={"domain": "news.test", "crawl_delay": 2.0},
    )
    assert res.status_code == 201
    sid = res.json()["id"]
    # duplicate
    assert client.post(
        "/api/v1/crawl/sites", headers=editor_headers, json={"domain": "news.test"}
    ).status_code == 409
    # patch
    patched = client.patch(
        f"/api/v1/crawl/sites/{sid}",
        headers=editor_headers,
        json={"domain": "news.test", "is_blacklisted": 1, "crawl_delay": 9},
    )
    assert patched.json()["is_blacklisted"] == 1


def test_sites_require_editor(client, reader_headers):
    assert client.get("/api/v1/crawl/sites", headers=reader_headers).status_code == 403


def test_patch_missing_site(client, editor_headers):
    assert client.patch(
        "/api/v1/crawl/sites/9999", headers=editor_headers, json={"domain": "x.test"}
    ).status_code == 404


def test_enqueue_and_list_tasks(client, editor_headers, monkeypatch):
    monkeypatch.setattr(crawler, "default_fetcher", fake_fetcher)
    res = client.post(
        "/api/v1/crawl/tasks",
        headers=editor_headers,
        json={"url": "https://fresh.test/a"},
    )
    assert res.status_code == 201
    assert res.json()["status"] == "done"
    assert res.json()["robots_decision"] == "allowed"
    tasks = client.get("/api/v1/crawl/tasks?status=done", headers=editor_headers).json()
    assert any(t["url"] == "https://fresh.test/a" for t in tasks)


def test_enqueue_disallowed(client, editor_headers, monkeypatch):
    monkeypatch.setattr(crawler, "default_fetcher", disallow_fetcher)
    res = client.post(
        "/api/v1/crawl/tasks",
        headers=editor_headers,
        json={"url": "https://blocked.test/x"},
    )
    assert res.json()["status"] == "disallowed"


def test_check_robots_endpoint(client, editor_headers, monkeypatch):
    monkeypatch.setattr(crawler, "default_fetcher", disallow_fetcher)
    res = client.get(
        "/api/v1/crawl/check-robots?url=https://blocked.test/x", headers=editor_headers
    )
    assert res.status_code == 200
    assert res.json()["allowed"] is False
    assert res.json()["decision"] == "disallowed"
