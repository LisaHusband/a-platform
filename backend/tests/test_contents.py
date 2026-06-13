def test_list_contents_default(client):
    res = client.get("/api/v1/contents")
    assert res.status_code == 200
    items = res.json()
    # 7 published (c8 is a pending draft)
    assert len(items) == 7
    assert all(i["status"] == "published" for i in items)


def test_list_filters_by_category_with_descendants(client):
    # tech is a root with children ai-systems / distributed
    res = client.get("/api/v1/contents?category=tech")
    slugs = {i["category"]["slug"] for i in res.json()}
    assert slugs <= {"ai-systems", "distributed"}
    assert len(res.json()) >= 3


def test_list_unknown_category_404(client):
    assert client.get("/api/v1/contents?category=nope").status_code == 404


def test_list_filter_tag_topic_type_lang(client):
    assert all(
        any(t["slug"] == "llm" for t in i["tags"])
        for i in client.get("/api/v1/contents?tag=llm").json()
    )
    assert len(client.get("/api/v1/contents?topic=trust-systems").json()) >= 1
    assert all(
        i["content_type"] == "video"
        for i in client.get("/api/v1/contents?content_type=video").json()
    )
    assert all(i["lang"] == "en" for i in client.get("/api/v1/contents?lang=en").json())


def test_list_sorts(client):
    newest = client.get("/api/v1/contents?sort=newest").json()
    oldest = client.get("/api/v1/contents?sort=oldest").json()
    assert newest[0]["id"] == oldest[-1]["id"]
    titles = [i["title"] for i in client.get("/api/v1/contents?sort=title").json()]
    assert titles == sorted(titles)


def test_get_published_paywalled_anonymous(client):
    res = client.get("/api/v1/contents/1")  # price 12, standalone
    assert res.status_code == 200
    data = res.json()
    assert data["has_access"] is False
    assert data["body"] is None
    assert len(data["preview"]) > 0


def test_get_free_content_has_body(client):
    res = client.get("/api/v1/contents/4")  # free, subscription-bundle, price 0
    assert res.json()["has_access"] is True
    assert res.json()["body"] is not None


def test_get_with_topic_subscription(client, reader_headers):
    # reader subscribes to trust-systems; c2 belongs to it
    res = client.get("/api/v1/contents/2", headers=reader_headers)
    assert res.json()["has_access"] is True


def test_get_missing_content_404(client):
    assert client.get("/api/v1/contents/9999").status_code == 404


def test_unpublished_visible_to_author_not_anon(client, author_headers):
    assert client.get("/api/v1/contents/8").status_code == 404  # anon
    res = client.get("/api/v1/contents/8", headers=author_headers)
    assert res.status_code == 200
    assert res.json()["status"] == "pending"


def test_unpublished_hidden_from_other_reader(client, reader_headers):
    assert client.get("/api/v1/contents/8", headers=reader_headers).status_code == 404


def test_related_returns_editorial_edges(client):
    related = client.get("/api/v1/contents/1/related").json()
    ids = {r["id"] for r in related}
    assert {3, 6} <= ids  # seeded edges c1->c3, c1->c6


def test_related_empty(client):
    # c8 (pending draft) has no editorial relation edges
    assert client.get("/api/v1/contents/8/related").json() == []


def test_graph_all_and_filtered(client):
    full = client.get("/api/v1/contents/graph").json()
    assert len(full["nodes"]) == 7
    assert len(full["edges"]) == 6
    filtered = client.get("/api/v1/contents/graph?topic=trust-systems").json()
    assert len(filtered["nodes"]) >= 1
    assert len(filtered["nodes"]) < len(full["nodes"])


def test_create_content_requires_auth(client):
    res = client.post("/api/v1/contents", json={})
    assert res.status_code in (401, 422)


def test_create_content_unknown_category(client, author_headers):
    res = client.post(
        "/api/v1/contents",
        headers=author_headers,
        json={
            "title": "测试标题足够长",
            "body": "正文内容" * 50,
            "category_id": 9999,
        },
    )
    assert res.status_code == 400


def test_create_content_success(client, author_headers):
    res = client.post(
        "/api/v1/contents",
        headers=author_headers,
        json={
            "title": "一个全新的研究标题",
            "subtitle": "副标题",
            "abstract": "摘要内容用于免费预览，长度需要足够。",
            "body": "## 引言\n\n" + ("正文段落内容。" * 80),
            "sources": "[1] 来源",
            "price": 5.0,
            "category_id": 1,
            "tag_slugs": ["llm"],
            "topic_slugs": ["ai-infra"],
            "content_type": "article",
            "lang": "zh",
        },
    )
    assert res.status_code == 201
    data = res.json()
    assert data["status"] == "pending"
    assert data["has_access"] is True  # author sees own body
    assert data["body"] is not None
    assert len(data["tags"]) == 1


def test_publish_flow(client, author_headers, editor_headers, db):
    # create -> tier1 -> tier2 -> publish
    created = client.post(
        "/api/v1/contents",
        headers=author_headers,
        json={
            "title": "可发布的高质量长文标题",
            "abstract": "这是一段足够长的摘要用来通过规则检查。",
            "body": "## 章节一\n\n"
            + ("详实的正文内容并附引用 [1]。" * 90)
            + "\n\n## 章节二\n\n更多内容。",
            "sources": "[1] https://example.com",
            "price": 4.0,
            "category_id": 1,
        },
    )
    cid = created.json()["id"]
    assert client.post(f"/api/v1/review/{cid}/tier1", headers=author_headers).json()["passed"]
    client.post(
        f"/api/v1/review/{cid}/tier2", headers=editor_headers, json={"verdict": "pass"}
    )
    res = client.post(f"/api/v1/contents/{cid}/publish", headers=editor_headers)
    assert res.status_code == 200
    assert res.json()["status"] == "published"


def test_publish_requires_editor(client, reader_headers):
    assert client.post("/api/v1/contents/1/publish", headers=reader_headers).status_code == 403


def test_publish_missing_404(client, editor_headers):
    assert client.post("/api/v1/contents/9999/publish", headers=editor_headers).status_code == 404


def test_publish_wrong_status_conflict(client, editor_headers):
    # c8 is 'pending', cannot publish directly
    assert client.post("/api/v1/contents/8/publish", headers=editor_headers).status_code == 409
