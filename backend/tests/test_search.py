from app.services.search_engine import INDEX, parse_query, tokenize


def test_basic_search(client):
    res = client.get("/api/v1/search", params={"q": "推理成本"})
    assert res.status_code == 200
    data = res.json()
    assert data["total"] >= 1
    assert data["hits"][0]["explanation"]
    assert "<mark>" in data["hits"][0]["snippet"]
    assert data["took_ms"] >= 0


def test_phrase_and_exclude(client):
    res = client.get("/api/v1/search", params={"q": '"推理成本" -广告'})
    assert res.status_code == 200
    assert res.json()["total"] >= 1


def test_field_operators(client):
    assert client.get("/api/v1/search", params={"q": "lang:en"}).json()["total"] >= 1
    assert client.get("/api/v1/search", params={"q": "type:report"}).json()["total"] >= 1
    assert client.get("/api/v1/search", params={"q": "tag:llm"}).json()["total"] >= 1
    assert client.get("/api/v1/search", params={"q": "topic:ai-infra"}).json()["total"] >= 1
    assert client.get("/api/v1/search", params={"q": "author:研究员"}).json()["total"] >= 1


def test_date_operators(client):
    before = client.get("/api/v1/search", params={"q": "before:2030-01-01"}).json()
    after = client.get("/api/v1/search", params={"q": "after:2000-01-01"}).json()
    assert before["total"] >= 1 and after["total"] >= 1
    none = client.get("/api/v1/search", params={"q": "after:2030-01-01"}).json()
    assert none["total"] == 0


def test_invalid_date_operator_ignored(client):
    # malformed date should not crash; treated as no-op filter
    res = client.get("/api/v1/search", params={"q": "推理 before:notadate"})
    assert res.status_code == 200


def test_did_you_mean(client):
    res = client.get("/api/v1/search", params={"q": "explainabel"})  # typo of explainable
    assert res.json()["did_you_mean"] is not None


def test_no_did_you_mean_for_good_query(client):
    res = client.get("/api/v1/search", params={"q": "consensus"})
    assert res.json()["did_you_mean"] is None


def test_sort_variants(client):
    for sort in ("relevance", "newest", "oldest", "title"):
        res = client.get("/api/v1/search", params={"q": "系统", "sort": sort})
        assert res.status_code == 200


def test_pagination(client):
    page1 = client.get("/api/v1/search", params={"q": "系统", "page": 1, "page_size": 1}).json()
    assert page1["page_size"] == 1
    assert len(page1["hits"]) <= 1


def test_suggest(client):
    res = client.get("/api/v1/search/suggest", params={"q": "EUV"})
    assert any("EUV" in s for s in res.json())


def test_suggest_empty(client):
    assert client.get("/api/v1/search/suggest", params={"q": "  "}).json() == []


# --- search_engine unit-level ---


def test_tokenize_latin_and_cjk():
    assert tokenize("Hello World") == ["hello", "world"]
    assert tokenize("推理") == ["推理"]  # bigram of 2-char run
    assert tokenize("好") == ["好"]  # single CJK char
    assert tokenize("AI系统") == ["ai", "系统"]


def test_parse_query_components():
    pq = parse_query('"machine learning" -spam tag:llm foo')
    assert "machine learning" in pq.phrases
    assert "spam" in pq.excludes
    assert pq.filters["tag"] == "llm"
    assert "foo" in pq.raw_terms


def test_index_did_you_mean_skips_cjk():
    assert INDEX.did_you_mean(["推理"], "推理") is None


def test_index_suggest_prefix_and_contains():
    INDEX.suggest_phrases = ["Alpha Beta", "Gamma Alpha", "Delta"]
    out = INDEX.suggest("alpha")
    assert out[0] == "Alpha Beta"  # prefix match ranks first
    assert "Gamma Alpha" in out  # contains match included


def test_index_snippet_without_match_falls_back():
    class Doc:
        abstract = "some abstract text"
        body = "body content here"

    snippet = INDEX.snippet(Doc(), ["zzz"], [])
    assert isinstance(snippet, str)
    assert len(snippet) > 0
