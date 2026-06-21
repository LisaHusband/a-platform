import io

from app.services import crawler

HTML = (
    "<html><head><title>投稿抓取标题</title></head>"
    "<body><p>抓取正文足够长内容。</p></body></html>"
)


def fake_fetcher(url):
    if url.endswith("robots.txt"):
        return 200, "User-agent: *\nAllow: /\n"
    return 200, HTML


def test_paste_submission(client, author_headers):
    res = client.post(
        "/api/v1/submissions",
        headers=author_headers,
        json={
            "source_type": "paste",
            "title": "我的粘贴投稿标题",
            "body": "这是粘贴的正文内容，足够长用于测试。" * 5,
            "category_id": 1,
            "tag_slugs": ["llm"],
        },
    )
    assert res.status_code == 201
    data = res.json()
    assert data["status"] == "pending"
    assert data["source_type"] == "paste"
    assert len(data["tags"]) == 1


def test_paste_requires_title_and_body(client, author_headers):
    res = client.post(
        "/api/v1/submissions",
        headers=author_headers,
        json={"source_type": "paste", "title": "", "body": ""},
    )
    assert res.status_code == 400


def test_paste_duplicate_rejected(client, author_headers):
    body = {"source_type": "paste", "title": "重复检测标题", "body": "重复正文内容用于校验。" * 4}
    assert client.post("/api/v1/submissions", headers=author_headers, json=body).status_code == 201
    assert client.post("/api/v1/submissions", headers=author_headers, json=body).status_code == 409


def test_url_submission(client, author_headers, monkeypatch):
    monkeypatch.setattr(crawler, "default_fetcher", fake_fetcher)
    res = client.post(
        "/api/v1/submissions",
        headers=author_headers,
        json={"source_type": "url", "url": "https://sub.test/a", "category_id": 1},
    )
    assert res.status_code == 201
    assert res.json()["source_type"] == "crawl"
    assert res.json()["source_domain"] == "sub.test"


def test_url_submission_blocked(client, author_headers, monkeypatch):
    def disallow(url):
        if url.endswith("robots.txt"):
            return 200, "User-agent: *\nDisallow: /\n"
        return 200, HTML
    monkeypatch.setattr(crawler, "default_fetcher", disallow)
    res = client.post(
        "/api/v1/submissions",
        headers=author_headers,
        json={"source_type": "url", "url": "https://block.test/a"},
    )
    assert res.status_code == 409


def test_url_submission_requires_url(client, author_headers):
    res = client.post(
        "/api/v1/submissions", headers=author_headers, json={"source_type": "url", "url": ""}
    )
    assert res.status_code == 400


def test_submission_requires_auth(client):
    assert client.post(
        "/api/v1/submissions", json={"source_type": "paste", "title": "x", "body": "y"}
    ).status_code == 401


def test_file_submission_and_download(client, author_headers):
    files = {"file": ("note.txt", io.BytesIO("文件正文内容".encode()), "text/plain")}
    res = client.post(
        "/api/v1/submissions/file",
        headers=author_headers,
        data={"title": "我的文件投稿", "content_type": "article", "category_id": "1"},
        files=files,
    )
    assert res.status_code == 201
    assert res.json()["source_type"] == "file"
    assert "文件正文内容" in res.json()["body"]


def test_file_not_found(client):
    assert client.get("/api/v1/submissions/files/missing.txt").status_code == 404
