def _draft(client, author_headers, *, good=True):
    if good:
        body = "## 章节\n\n" + ("详实正文并引用 [1]。" * 90) + "\n\n## 小结\n\n收尾内容。"
        abstract = "足够长度的摘要用于免费预览展示。"
    else:
        body = "太短"
        abstract = ""
    res = client.post(
        "/api/v1/contents",
        headers=author_headers,
        json={
            "title": "审核流程测试标题",
            "abstract": abstract,
            "body": body,
            "sources": "[1] https://example.com" if good else "",
            "price": 4.0,
            "category_id": 1,
        },
    )
    return res.json()["id"]


def test_tier1_pass_by_author(client, author_headers):
    cid = _draft(client, author_headers)
    res = client.post(f"/api/v1/review/{cid}/tier1", headers=author_headers)
    assert res.status_code == 200
    body = res.json()
    assert body["passed"] is True
    assert body["status"] == "tier1_passed"
    assert any(r["rule"] == "min-length" for r in body["rules"])


def test_tier1_reject_low_quality(client, author_headers):
    cid = _draft(client, author_headers, good=False)
    res = client.post(f"/api/v1/review/{cid}/tier1", headers=author_headers)
    assert res.json()["passed"] is False
    assert res.json()["status"] == "rejected"


def test_tier1_not_your_content_forbidden(client, author_headers, reader_headers):
    cid = _draft(client, author_headers)
    assert client.post(f"/api/v1/review/{cid}/tier1", headers=reader_headers).status_code == 403


def test_tier1_missing_404(client, author_headers):
    assert client.post("/api/v1/review/9999/tier1", headers=author_headers).status_code == 404


def test_tier1_wrong_status_conflict(client, author_headers):
    cid = _draft(client, author_headers)
    client.post(f"/api/v1/review/{cid}/tier1", headers=author_headers)
    # second run: status no longer 'pending'
    assert client.post(f"/api/v1/review/{cid}/tier1", headers=author_headers).status_code == 409


def test_tier2_editor_pass(client, author_headers, editor_headers):
    cid = _draft(client, author_headers)
    client.post(f"/api/v1/review/{cid}/tier1", headers=author_headers)
    res = client.post(
        f"/api/v1/review/{cid}/tier2", headers=editor_headers, json={"verdict": "pass"}
    )
    assert res.status_code == 200
    assert res.json()["status"] == "tier2_passed"


def test_tier2_reject(client, author_headers, editor_headers):
    cid = _draft(client, author_headers)
    client.post(f"/api/v1/review/{cid}/tier1", headers=author_headers)
    res = client.post(
        f"/api/v1/review/{cid}/tier2", headers=editor_headers, json={"verdict": "reject"}
    )
    assert res.json()["status"] == "rejected"


def test_tier2_requires_editor_role(client, author_headers, reader_headers):
    cid = _draft(client, author_headers)
    client.post(f"/api/v1/review/{cid}/tier1", headers=author_headers)
    res = client.post(
        f"/api/v1/review/{cid}/tier2", headers=reader_headers, json={"verdict": "pass"}
    )
    assert res.status_code == 403


def test_tier2_invalid_verdict(client, author_headers, editor_headers):
    cid = _draft(client, author_headers)
    client.post(f"/api/v1/review/{cid}/tier1", headers=author_headers)
    res = client.post(
        f"/api/v1/review/{cid}/tier2", headers=editor_headers, json={"verdict": "maybe"}
    )
    assert res.status_code == 400


def test_tier2_wrong_status_conflict(client, author_headers, editor_headers):
    cid = _draft(client, author_headers)  # still 'pending'
    res = client.post(
        f"/api/v1/review/{cid}/tier2", headers=editor_headers, json={"verdict": "pass"}
    )
    assert res.status_code == 409


def test_tier3_expert(client, author_headers, editor_headers, expert_headers):
    cid = _draft(client, author_headers)
    client.post(f"/api/v1/review/{cid}/tier1", headers=author_headers)
    client.post(f"/api/v1/review/{cid}/tier2", headers=editor_headers, json={"verdict": "pass"})
    res = client.post(
        f"/api/v1/review/{cid}/tier3", headers=expert_headers, json={"verdict": "pass"}
    )
    assert res.status_code == 200
    assert res.json()["status"] == "tier2_passed"


def test_tier3_missing_404(client, expert_headers):
    assert client.post(
        "/api/v1/review/9999/tier3", headers=expert_headers, json={"verdict": "pass"}
    ).status_code == 404


def test_queue_editor_sees_tier1_passed(client, author_headers, editor_headers):
    cid = _draft(client, author_headers)
    client.post(f"/api/v1/review/{cid}/tier1", headers=author_headers)
    queue = client.get("/api/v1/review/queue", headers=editor_headers).json()
    assert any(c["id"] == cid for c in queue)


def test_queue_expert(client, author_headers, editor_headers, expert_headers):
    cid = _draft(client, author_headers)
    client.post(f"/api/v1/review/{cid}/tier1", headers=author_headers)
    client.post(f"/api/v1/review/{cid}/tier2", headers=editor_headers, json={"verdict": "pass"})
    queue = client.get("/api/v1/review/queue", headers=expert_headers).json()
    assert any(c["id"] == cid for c in queue)


def test_queue_requires_role(client, reader_headers):
    assert client.get("/api/v1/review/queue", headers=reader_headers).status_code == 403
