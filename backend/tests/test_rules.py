from app.services.rules import run_tier1

GOOD_BODY = "## 引言\n\n" + ("高质量内容并引用来源 [1]。" * 80) + "\n\n## 结论\n\n收尾。"


def test_tier1_pass():
    passed, score, results = run_tier1(
        "一篇严肃的研究长文",
        GOOD_BODY,
        "这是一段足够长度的摘要用于免费预览展示给读者。",
        "[1] https://example.com",
    )
    assert passed is True
    assert score >= 90
    assert all(r.rule for r in results)


def test_tier1_fail_too_short():
    passed, score, results = run_tier1("标题够长的内容", "太短了", "摘要", "")
    assert passed is False
    assert any(r.rule == "min-length" and not r.passed for r in results)


def test_tier1_fail_clickbait():
    passed, _, results = run_tier1(
        "震惊！99%的人都不知道的秘密", GOOD_BODY, "摘要内容足够长用于预览展示给读者。", "[1] x"
    )
    assert passed is False
    assert any(r.rule == "no-clickbait-title" and not r.passed for r in results)


def test_tier1_fail_ads():
    body = GOOD_BODY + "\n加微信领取资料"
    passed, _, results = run_tier1(
        "正常的标题文本", body, "摘要内容足够长用于预览展示给读者。", "[1] x"
    )
    assert passed is False
    assert any(r.rule == "no-ads" and not r.passed for r in results)


def test_tier1_soft_penalties_no_structure_no_sources():
    body = "正文内容。" * 200  # long enough, but no headings, no sources
    passed, score, results = run_tier1(
        "一个普通的研究标题", body, "短", ""
    )
    rules = {r.rule: r for r in results}
    assert rules["structured"].penalty > 0
    assert rules["cited-sources"].penalty > 0
    assert rules["has-abstract"].penalty > 0
    assert score < 90


def test_tier1_exclamation_penalty():
    _, _, results = run_tier1(
        "标题！！多个感叹号", GOOD_BODY, "摘要内容足够长用于预览展示给读者。", "[1] x"
    )
    rules = {r.rule: r for r in results}
    assert rules["calm-title"].penalty > 0


def test_tier1_sources_via_url_in_body():
    body = GOOD_BODY.replace("[1]", "见 https://ref.example.com")
    _, _, results = run_tier1(
        "正常标题内容", body, "摘要内容足够长用于预览展示给读者。", ""
    )
    rules = {r.rule: r for r in results}
    assert rules["cited-sources"].passed is True
