def test_list_boards(client):
    boards = client.get("/api/v1/community/boards").json()
    slugs = {b["slug"] for b in boards}
    assert {"ai-infra", "research"} <= slugs


def test_create_board_requires_editor(client, reader_headers, editor_headers):
    payload = {"slug": "newbar", "name": "新吧", "description": "x"}
    denied = client.post("/api/v1/community/boards", headers=reader_headers, json=payload)
    assert denied.status_code == 403
    res = client.post("/api/v1/community/boards", headers=editor_headers, json=payload)
    assert res.status_code == 201
    assert res.json()["slug"] == "newbar"


def test_create_board_duplicate(client, editor_headers):
    payload = {"slug": "ai-infra", "name": "dup"}
    dup = client.post("/api/v1/community/boards", headers=editor_headers, json=payload)
    assert dup.status_code == 409


def test_list_threads_paginated_and_pinned_first(client):
    body = client.get("/api/v1/community/boards/ai-infra/threads").json()
    assert body["total"] >= 2
    assert body["items"][0]["is_pinned"] == 1  # pinned thread first


def test_list_threads_unknown_board_404(client):
    assert client.get("/api/v1/community/boards/ghost/threads").status_code == 404


def test_thread_search_in_board(client):
    body = client.get("/api/v1/community/boards/ai-infra/threads", params={"q": "H100"}).json()
    assert body["total"] >= 1
    assert any("H100" in t["title"] for t in body["items"])


def test_create_thread_and_view_increments(client, reader_headers):
    res = client.post(
        "/api/v1/community/boards/research/threads",
        headers=reader_headers,
        json={"title": "新主题：实验设计", "body": "想讨论对照组设置。"},
    )
    assert res.status_code == 201
    tid = res.json()["id"]
    v1 = client.get(f"/api/v1/community/threads/{tid}").json()["views"]
    v2 = client.get(f"/api/v1/community/threads/{tid}").json()["views"]
    assert v2 == v1 + 1


def test_reply_assigns_floor_and_updates_counts(client, reader_headers, author_headers):
    tid = client.post(
        "/api/v1/community/boards/research/threads",
        headers=author_headers,
        json={"title": "楼层测试主题帖", "body": "楼主帖"},
    ).json()["id"]
    r1 = client.post(
        f"/api/v1/community/threads/{tid}/posts", headers=reader_headers, json={"body": "二楼"}
    )
    assert r1.status_code == 201
    assert r1.json()["floor"] == 2
    r2 = client.post(
        f"/api/v1/community/threads/{tid}/posts", headers=author_headers, json={"body": "三楼"}
    )
    assert r2.json()["floor"] == 3
    posts = client.get(f"/api/v1/community/threads/{tid}/posts").json()
    assert posts["total"] == 2


def test_reply_to_locked_thread_conflict(client, reader_headers, editor_headers, author_headers):
    tid = client.post(
        "/api/v1/community/boards/research/threads",
        headers=author_headers,
        json={"title": "将被锁定的帖子标题", "body": "正文"},
    ).json()["id"]
    client.post(
        f"/api/v1/community/threads/{tid}/moderate",
        headers=editor_headers,
        json={"action": "lock"},
    )
    res = client.post(
        f"/api/v1/community/threads/{tid}/posts", headers=reader_headers, json={"body": "x"}
    )
    assert res.status_code == 409


def test_like_toggle_thread(client, reader_headers):
    tid = client.get("/api/v1/community/boards/ai-infra/threads").json()["items"][0]["id"]
    first = client.post(f"/api/v1/community/threads/{tid}/like", headers=reader_headers).json()
    assert first["liked"] is True
    second = client.post(f"/api/v1/community/threads/{tid}/like", headers=reader_headers).json()
    assert second["liked"] is False
    assert second["like_count"] == first["like_count"] - 1


def test_like_post(client, reader_headers, author_headers):
    tid = client.post(
        "/api/v1/community/boards/research/threads",
        headers=author_headers,
        json={"title": "点赞楼层测试", "body": "楼主"},
    ).json()["id"]
    pid = client.post(
        f"/api/v1/community/threads/{tid}/posts", headers=author_headers, json={"body": "二楼"}
    ).json()["id"]
    res = client.post(f"/api/v1/community/posts/{pid}/like", headers=reader_headers).json()
    assert res["liked"] is True and res["like_count"] == 1


def test_moderation_actions(client, editor_headers):
    tid = client.get("/api/v1/community/boards/ai-infra/threads").json()["items"][0]["id"]
    for action in ("feature", "unfeature", "lock", "unlock", "unpin"):
        res = client.post(
            f"/api/v1/community/threads/{tid}/moderate",
            headers=editor_headers,
            json={"action": action},
        )
        assert res.status_code == 200


def test_moderation_bad_action(client, editor_headers):
    tid = client.get("/api/v1/community/boards/ai-infra/threads").json()["items"][0]["id"]
    res = client.post(
        f"/api/v1/community/threads/{tid}/moderate",
        headers=editor_headers,
        json={"action": "nuke"},
    )
    assert res.status_code == 400


def test_moderation_requires_editor(client, reader_headers):
    tid = client.get("/api/v1/community/boards/ai-infra/threads").json()["items"][0]["id"]
    res = client.post(
        f"/api/v1/community/threads/{tid}/moderate",
        headers=reader_headers,
        json={"action": "pin"},
    )
    assert res.status_code == 403


def test_cross_board_search(client):
    body = client.get("/api/v1/community/search", params={"q": "复现"}).json()
    assert body["total"] >= 1


def test_thread_and_posts_404(client, reader_headers):
    assert client.get("/api/v1/community/threads/9999").status_code == 404
    assert client.get("/api/v1/community/threads/9999/posts").status_code == 404
    assert client.post(
        "/api/v1/community/threads/9999/like", headers=reader_headers
    ).status_code == 404
    assert client.post(
        "/api/v1/community/posts/9999/like", headers=reader_headers
    ).status_code == 404


def test_create_thread_requires_auth(client):
    res = client.post(
        "/api/v1/community/boards/ai-infra/threads", json={"title": "xxxx", "body": "y"}
    )
    assert res.status_code == 401
