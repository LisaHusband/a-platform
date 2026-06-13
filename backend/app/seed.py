"""Seed demo taxonomy, users and contents on first boot (empty DB only).

Demo accounts (password for all: `password123`):
    admin@a.dev / editor@a.dev / expert@a.dev / author@a.dev / reader@a.dev
"""

from datetime import UTC, datetime, timedelta

from sqlalchemy.orm import Session

from .auth import hash_password
from .models import (
    Category,
    Content,
    ContentRelation,
    Subscription,
    Tag,
    Topic,
    User,
)


def _body(lang: str, title: str, sections: list[tuple[str, str]]) -> str:
    parts = [f"# {title}\n"]
    for heading, para in sections:
        parts.append(f"\n## {heading}\n\n{para}\n")
    return "\n".join(parts)


def seed_if_empty(db: Session) -> None:
    if db.query(User).first():
        return

    pw = hash_password("password123")
    users = {
        role: User(email=f"{role}@a.dev", name=name, password_hash=pw, role=role)
        for role, name in [
            ("admin", "Admin"),
            ("editor", "行业编辑·李审"),
            ("expert", "领域专家·王衡"),
            ("author", "研究员·陈深"),
            ("reader", "读者·小明"),
        ]
    }
    db.add_all(users.values())
    db.flush()

    cats = {
        "tech": Category(slug="tech", name_zh="技术", name_en="Technology"),
        "finance": Category(slug="finance", name_zh="金融与投资", name_en="Finance & Investing"),
        "science": Category(slug="science", name_zh="科学研究", name_en="Science"),
        "industry": Category(slug="industry", name_zh="行业研究", name_en="Industry Research"),
    }
    db.add_all(cats.values())
    db.flush()
    sub_cats = {
        "ai-systems": Category(slug="ai-systems", name_zh="AI 系统", name_en="AI Systems", parent_id=cats["tech"].id),
        "distributed": Category(slug="distributed", name_zh="分布式系统", name_en="Distributed Systems", parent_id=cats["tech"].id),
        "macro": Category(slug="macro", name_zh="宏观经济", name_en="Macroeconomics", parent_id=cats["finance"].id),
        "semiconductor": Category(slug="semiconductor", name_zh="半导体", name_en="Semiconductors", parent_id=cats["industry"].id),
    }
    db.add_all(sub_cats.values())

    tags = {
        s: Tag(slug=s, name_zh=zh, name_en=en)
        for s, zh, en in [
            ("llm", "大语言模型", "LLM"),
            ("inference", "推理优化", "Inference"),
            ("consensus", "共识算法", "Consensus"),
            ("rates", "利率", "Interest Rates"),
            ("euv", "EUV 光刻", "EUV Lithography"),
            ("benchmark", "基准测试", "Benchmark"),
            ("methodology", "研究方法", "Methodology"),
        ]
    }
    db.add_all(tags.values())

    topics = {
        s: Topic(slug=s, name_zh=zh, name_en=en, description_zh=dzh, description_en=den)
        for s, zh, en, dzh, den in [
            (
                "ai-infra", "AI 基础设施", "AI Infrastructure",
                "从芯片到推理服务的完整 AI 基础设施研究专题。",
                "End-to-end research on AI infrastructure, from silicon to serving.",
            ),
            (
                "trust-systems", "可信系统", "Trustworthy Systems",
                "关于构建可验证、可解释系统的长期研究。",
                "Long-term research on verifiable and explainable systems.",
            ),
            (
                "capital-cycles", "资本周期", "Capital Cycles",
                "利率、流动性与产业资本开支的周期研究。",
                "Cycle studies of rates, liquidity and industrial capex.",
            ),
        ]
    }
    db.add_all(topics.values())
    db.flush()

    author = users["author"]
    now = datetime.now(UTC)

    def make(
        title, subtitle, abstract, lang, ctype, cat, tag_keys, topic_keys,
        price, sections, sources, days_ago, status="published",
    ):
        body = _body(lang, title, sections)
        c = Content(
            title=title,
            subtitle=subtitle,
            abstract=abstract,
            body=body,
            lang=lang,
            content_type=ctype,
            category_id=cat.id,
            price=price,
            sources=sources,
            author_id=author.id,
            status=status,
            published_at=now - timedelta(days=days_ago) if status == "published" else None,
            created_at=now - timedelta(days=days_ago + 3),
            reading_minutes=max(3, len(body) // 600),
        )
        c.tags = [tags[k] for k in tag_keys]
        c.topics = [topics[k] for k in topic_keys]
        db.add(c)
        return c

    p_zh = (
        "本节基于公开数据与一手访谈展开分析。我们首先界定问题边界，"
        "然后给出度量方法与数据来源，再讨论主要发现及其局限性。"
        "所有结论均附带可复核的引用，读者可以沿引用链路独立验证。"
        "与情绪化叙事不同，本文刻意保持克制的措辞，将不确定性显式标注，"
        "并在文末给出反方观点与未解问题清单，供后续研究继续推进。"
    )
    p_en = (
        "This section builds on public datasets and primary interviews. "
        "We first define the boundary of the question, then describe the "
        "measurement methodology and data sources, and finally discuss the "
        "main findings together with their limitations. Every claim carries "
        "a verifiable citation so readers can audit the reasoning chain "
        "independently. Uncertainty is stated explicitly, and open questions "
        "are listed at the end for future work."
    )

    c1 = make(
        "大模型推理成本的结构性下降：测算框架与产业含义",
        "从 FLOPs 到单位 token 成本的完整推导",
        "本文建立了一个可复核的推理成本测算框架，拆解硬件折旧、能耗、利用率与批处理策略四个变量，并测算 2023-2026 年单位 token 成本的下降曲线。",
        "zh", "report", sub_cats["ai-systems"], ["llm", "inference"], ["ai-infra"],
        12.0,
        [("测算框架", p_zh), ("硬件折旧模型", p_zh), ("利用率与批处理", p_zh), ("产业含义", p_zh), ("局限与反方观点", p_zh)],
        "[1] NVIDIA H100 datasheet\n[2] SemiAnalysis inference cost series\n[3] 公开云厂商定价页",
        5,
    )
    c2 = make(
        "Raft 之后：新一代共识协议的工程取舍",
        "EPaxos、Kraft 与确定性数据库的对比研究",
        "对五种生产级共识实现进行了基准测试与故障注入实验，给出延迟、吞吐与运维复杂度的三维对比，并讨论确定性执行对共识层的简化作用。",
        "zh", "article", sub_cats["distributed"], ["consensus", "benchmark"], ["trust-systems"],
        6.0,
        [("实验设置", p_zh), ("延迟与吞吐", p_zh), ("故障注入结果", p_zh), ("运维复杂度", p_zh), ("结论", p_zh)],
        "[1] Raft 论文 (Ongaro 2014)\n[2] EPaxos revisited (NSDI 21)\n[3] 实验仓库 https://example.com/consensus-bench",
        12,
    )
    c3 = make(
        "The Real Cost of EUV: A Bottom-Up Teardown",
        "What ASML's backlog tells us about 2027 capacity",
        "A bottom-up cost teardown of EUV lithography, reconciling ASML disclosures with fab-level capex filings to estimate true wafer-level cost contribution through 2027.",
        "en", "report", sub_cats["semiconductor"], ["euv"], ["ai-infra", "capital-cycles"],
        18.0,
        [("Methodology", p_en), ("Tool Economics", p_en), ("Fab-Level Reconciliation", p_en), ("2027 Capacity Outlook", p_en), ("Risks and Counterarguments", p_en)],
        "[1] ASML 2025 annual report\n[2] TSMC capex filings\n[3] IMEC cost model",
        20,
    )
    c4 = make(
        "利率周期与半导体资本开支：一个跨周期的实证",
        "1990-2025 年六轮周期的面板回归",
        "利用六轮利率周期的面板数据检验资金成本对晶圆厂资本开支的滞后影响，发现滞后期约为五个季度，且在高利率环境下行业集中度显著上升。",
        "zh", "article", sub_cats["macro"], ["rates", "methodology"], ["capital-cycles"],
        0.0,
        [("数据与方法", p_zh), ("回归结果", p_zh), ("稳健性检验", p_zh), ("讨论", p_zh)],
        "[1] FRED 利率序列\n[2] Gartner capex 数据库",
        30,
    )
    c4.is_standalone_purchase = 0  # free sample
    c5 = make(
        "Explainable Ranking: Search Without Behavioral Signals",
        "Why we rejected PageRank and engagement metrics",
        "Design notes for a content search system that ranks purely on auditable text relevance (BM25) plus explicit metadata, with a full per-result score breakdown shown to users.",
        "en", "article", sub_cats["ai-systems"], ["methodology", "benchmark"], ["trust-systems"],
        6.0,
        [("Why Not PageRank", p_en), ("BM25 With Field Weights", p_en), ("Operator Grammar", p_en), ("Auditability", p_en)],
        "[1] Robertson & Zaragoza, BM25 and beyond\n[2] Internal design doc",
        8,
    )
    c6 = make(
        "AI 基础设施年度图景（视频）",
        "90 分钟深度纪录片",
        "实地走访三座数据中心与两家芯片设计公司，完整记录一块训练芯片从流片到上架推理集群的全过程。",
        "zh", "video", sub_cats["ai-systems"], ["llm", "euv"], ["ai-infra"],
        25.0,
        [("内容简介", p_zh), ("章节列表", p_zh), ("制作说明", p_zh), ("引用与致谢", p_zh)],
        "[1] 拍摄许可文件\n[2] 受访者名单",
        2,
    )
    c7 = make(
        "研究型播客：与三位 SRE 谈确定性系统（音频）",
        "120 分钟,附完整文字稿",
        "三位一线 SRE 复盘各自经历的重大故障，讨论确定性重放、形式化验证在生产环境中的真实落地成本。",
        "zh", "audio", sub_cats["distributed"], ["consensus"], ["trust-systems"],
        8.0,
        [("嘉宾介绍", p_zh), ("故障复盘一", p_zh), ("故障复盘二", p_zh), ("文字稿说明", p_zh)],
        "[1] 文字稿全文\n[2] 提及论文列表",
        15,
    )
    make(  # c8: pending draft, intentionally left unpublished
        "未刊稿：内容平台冷启动的供给侧策略",
        "草稿,等待审核",
        "讨论高质量内容平台冷启动阶段的创作者激励设计。",
        "zh", "article", cats["industry"], ["methodology"], ["capital-cycles"],
        6.0,
        [("问题界定", p_zh), ("供给侧激励", p_zh), ("案例", p_zh)],
        "[1] 案例访谈记录",
        0, status="pending",
    )
    db.flush()

    db.add_all([
        ContentRelation(src_id=c1.id, dst_id=c3.id, relation="cites"),
        ContentRelation(src_id=c1.id, dst_id=c6.id, relation="related"),
        ContentRelation(src_id=c2.id, dst_id=c7.id, relation="related"),
        ContentRelation(src_id=c2.id, dst_id=c5.id, relation="contrasts"),
        ContentRelation(src_id=c3.id, dst_id=c4.id, relation="follows"),
        ContentRelation(src_id=c5.id, dst_id=c1.id, relation="cites"),
    ])

    # reader gets an active topic subscription for demo purposes
    db.add(
        Subscription(
            user_id=users["reader"].id,
            plan="topic",
            topic_id=topics["trust-systems"].id,
            expires_at=now + timedelta(days=30),
        )
    )
    db.commit()
