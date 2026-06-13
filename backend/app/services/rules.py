"""Tier-1 review: fixed, explainable quality rules (no black-box scoring).

Each rule returns (passed, message). A submission must clear every hard rule;
soft rules deduct from a 100-point quality score with a 60-point floor.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

CLICKBAIT_PATTERNS = [
    r"震惊", r"惊呆", r"不转不是", r"必看", r"99%的人", r"速看", r"删前快看",
    r"you won'?t believe", r"shocking", r"top \d+ secrets", r"doctors hate",
]
AD_PATTERNS = [r"加微信", r"扫码关注", r"点击购买", r"限时优惠", r"buy now", r"limited offer"]


@dataclass
class RuleResult:
    rule: str
    passed: bool
    message: str
    penalty: int = 0


def run_tier1(
    title: str, body: str, abstract: str, sources: str
) -> tuple[bool, int, list[RuleResult]]:
    results: list[RuleResult] = []
    words = len(body)

    def hard(rule: str, ok: bool, msg: str):
        results.append(RuleResult(rule, ok, msg))

    def soft(rule: str, ok: bool, msg: str, penalty: int):
        results.append(RuleResult(rule, ok, msg, 0 if ok else penalty))

    hard(
        "min-length",
        words >= 800,
        f"正文长度 {words} 字符（要求 ≥ 800，拒绝碎片化内容）",
    )
    clickbait = [p for p in CLICKBAIT_PATTERNS if re.search(p, title, re.IGNORECASE)]
    hard(
        "no-clickbait-title",
        not clickbait,
        "标题未命中情绪化模式" if not clickbait else f"标题命中情绪化模式: {clickbait}",
    )
    ads = [p for p in AD_PATTERNS if re.search(p, body, re.IGNORECASE)]
    hard("no-ads", not ads, "未检测到广告引流内容" if not ads else f"命中广告模式: {ads}")

    lines = [line for line in body.splitlines() if line.strip()]
    headings = sum(1 for line in lines if line.lstrip().startswith("#"))
    soft(
        "structured",
        headings >= 2,
        f"检测到 {headings} 个章节标题（建议 ≥ 2，结构化表达）",
        15,
    )
    has_sources = bool(sources.strip()) or bool(re.search(r"\[\d+\]|https?://", body))
    soft(
        "cited-sources",
        has_sources,
        "包含引用来源" if has_sources else "未发现引用来源（高可信度要求注明出处）",
        20,
    )
    soft(
        "has-abstract",
        len(abstract.strip()) >= 40,
        f"摘要长度 {len(abstract.strip())}（建议 ≥ 40，供免费预览）",
        10,
    )
    exclam = title.count("!") + title.count("！")
    soft("calm-title", exclam <= 1, f"标题感叹号 {exclam} 个（≤1）", 10)

    score = 100 - sum(r.penalty for r in results)
    passed = all(r.passed for r in results if r.penalty == 0) and score >= 60
    return passed, score, results
