def test_admin_list_contents_includes_unpublished(client, editor_headers):
    body = client.get("/api/v1/admin/contents?status=pending", headers=editor_headers).json()
    assert body["total"] >= 1
    assert all(c["status"] == "pending" for c in body["items"])


def test_admin_requires_editor(client, reader_headers):
    assert client.get("/api/v1/admin/contents", headers=reader_headers).status_code == 403


def test_moderate_approve_publishes_and_indexes(client, editor_headers):
    # c8 is a pending draft
    res = client.post(
        "/api/v1/admin/contents/8/moderate",
        headers=editor_headers,
        json={"action": "approve", "comment": "looks good"},
    )
    assert res.status_code == 200
    assert res.json()["status"] == "published"
    # now visible publicly
    detail = client.get("/api/v1/contents/8").json()
    assert detail["status"] == "published"
    # audit trail recorded
    hist = client.get("/api/v1/admin/contents/8/history", headers=editor_headers).json()
    assert hist[0]["action"] == "approve"
    assert hist[0]["before_status"] == "pending"
    assert hist[0]["after_status"] == "published"


def test_moderate_reject_needs_fix_archive(client, editor_headers):
    for action, expected in [
        ("reject", "rejected"),
        ("needs_fix", "needs_fix"),
        ("archive", "archived"),
    ]:
        res = client.post(
            "/api/v1/admin/contents/8/moderate",
            headers=editor_headers,
            json={"action": action},
        )
        assert res.json()["status"] == expected


def test_moderate_reclassify_and_retag(client, editor_headers):
    res = client.post(
        "/api/v1/admin/contents/8/moderate",
        headers=editor_headers,
        json={"action": "reclassify", "category_id": 2},
    )
    assert res.json()["category"]["id"] == 2
    res2 = client.post(
        "/api/v1/admin/contents/8/moderate",
        headers=editor_headers,
        json={"action": "retag", "tag_slugs": ["llm", "euv"]},
    )
    assert len(res2.json()["tags"]) == 2


def test_moderate_reclassify_requires_category(client, editor_headers):
    res = client.post(
        "/api/v1/admin/contents/8/moderate",
        headers=editor_headers,
        json={"action": "reclassify"},
    )
    assert res.status_code == 400


def test_moderate_set_quality(client, editor_headers):
    res = client.post(
        "/api/v1/admin/contents/8/moderate",
        headers=editor_headers,
        json={"action": "set_quality", "quality_score": 8.5},
    )
    assert res.json()["quality_score"] == 8.5


def test_moderate_set_quality_requires_value(client, editor_headers):
    res = client.post(
        "/api/v1/admin/contents/8/moderate",
        headers=editor_headers,
        json={"action": "set_quality"},
    )
    assert res.status_code == 400


def test_moderate_mark_flags(client, editor_headers):
    res = client.post(
        "/api/v1/admin/contents/8/moderate",
        headers=editor_headers,
        json={"action": "mark_duplicate", "comment": "dup of 1"},
    )
    assert res.status_code == 200


def test_moderate_unknown_action(client, editor_headers):
    res = client.post(
        "/api/v1/admin/contents/8/moderate",
        headers=editor_headers,
        json={"action": "explode"},
    )
    assert res.status_code == 400


def test_moderate_missing_content(client, editor_headers):
    assert client.post(
        "/api/v1/admin/contents/9999/moderate", headers=editor_headers, json={"action": "approve"}
    ).status_code == 404


# --- takedowns ---


def test_takedown_request_public(client):
    res = client.post(
        "/api/v1/admin/takedowns",
        json={"content_id": 1, "reason": "版权问题，请下架。"},
    )
    assert res.status_code == 201
    assert res.json()["status"] == "open"


def test_takedown_unknown_content(client):
    res = client.post(
        "/api/v1/admin/takedowns", json={"content_id": 9999, "reason": "x reason"}
    )
    assert res.status_code == 404


def test_takedown_list_and_resolve_archives(client, editor_headers):
    req = client.post(
        "/api/v1/admin/takedowns", json={"content_id": 1, "reason": "infringes copyright"}
    ).json()
    listing = client.get("/api/v1/admin/takedowns?status=open", headers=editor_headers).json()
    assert any(t["id"] == req["id"] for t in listing)
    resolved = client.post(
        f"/api/v1/admin/takedowns/{req['id']}/resolve",
        headers=editor_headers,
        json={"status": "resolved", "resolution": "removed per request"},
    )
    assert resolved.json()["status"] == "resolved"
    # content archived -> no longer publicly visible
    assert client.get("/api/v1/contents/1").status_code == 404


def test_takedown_resolve_bad_status(client, editor_headers):
    req = client.post(
        "/api/v1/admin/takedowns", json={"content_id": 1, "reason": "reason here"}
    ).json()
    res = client.post(
        f"/api/v1/admin/takedowns/{req['id']}/resolve",
        headers=editor_headers,
        json={"status": "maybe"},
    )
    assert res.status_code == 400


def test_takedown_resolve_missing(client, editor_headers):
    assert client.post(
        "/api/v1/admin/takedowns/9999/resolve",
        headers=editor_headers,
        json={"status": "rejected"},
    ).status_code == 404
