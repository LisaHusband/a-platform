# 变更日志 · Changelog

本项目所有重要变更均记录于此。
All notable changes to this project are documented here.

格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### 新增 · Added

- **合规爬虫 / Compliant crawler**（[crawler](backend/app/services/crawler.py)）：robots.txt 校验（disallow + crawl-delay，缺失视为放行）、HTML 正文抽取、URL 与内容指纹（sha256）去重、抓取失败重试与审计（CrawlTask）。
  robots.txt enforcement (disallow + crawl-delay, missing => allowed), HTML extraction, URL + content-fingerprint dedup, retry accounting and audit trail.
- **多来源投稿 / Multi-source submissions**（`/api/v1/submissions`）：粘贴正文、提交 URL（走合规爬虫）、上传文件（TXT/MD 抽取正文，其余留存元信息），统一进入待审队列。
  Paste, URL (via the crawler), and file upload, all entering the review queue.
- **站点与抓取管理 / Crawl & site management**（`/api/v1/crawl`）：站点配置（黑白名单、抓取间隔）、抓取入队、robots 预检。
- **管理后台 / Admin console**（`/api/v1/admin`）：内容审核（approve/reject/needs_fix/archive/reclassify/retag/set_quality）含审计记录（ReviewRecord）、下架/投诉受理（自动归档并移出索引）。
- **来源标注与举报 / Provenance & takedowns**：内容详情展示来源域名/原作者/原文链接；任何人可提交举报/下架请求。
- **前端 / Frontend**：投稿页三种来源标签页、管理控制台（审核/抓取/站点/下架四个分栏）、举报弹窗。
- **角色化工作台 / Role-based workbench**：导航与 `/workbench` 按角色（读者/作者/编辑/专家/管理员）展示不同入口；编辑/专家内置审核队列。
  Nav and `/workbench` surface different tools per role; editors/experts get an inline review queue.
- **沙箱支付 / Sandbox payments**：余额、支付宝、PayPal 三种方式（`/api/v1/payments`），测试用户默认 ¥1000 免费余额；钱包与支付记录页。
  Wallet balance, Alipay and PayPal flows; test users start with ¥1000 free credit; wallet + order history UI.
- **分类索引分页与关键词检索 / Paginated keyword catalog**：`/api/v1/contents` 返回分页信封并支持 `q` 关键词，复合数据库索引 + 内存倒排索引面向百万级毫秒响应。
  Paginated envelope with keyword `q`, backed by composite DB indexes and the in-memory inverted index for million-scale, millisecond responses.
- **贴吧式社区 / Tieba-style community**（`/api/v1/community`）：吧、主题帖、楼层回复、点赞、置顶/精华/锁定、分页与搜索；前端社区/板块/帖子页。
  Boards, threads, floor replies, likes, pin/feature/lock moderation, pagination and search, with community pages.
- **UI/UX 重设 / UI revamp**：渐变品牌色、卡片悬浮动效、支付弹窗、钱包卡片、角色徽章等。
  Gradient branding, motion, payment modal, wallet card, role badges.

### 变更 · Changed

- 计价货币由 USD 调整为 CNY（¥）/ pricing currency switched from USD to CNY (¥).

## [0.2.0] - 2026-06-13 — 自动化与生产就绪 / Automation & production-readiness

### 新增 · Added

- **CI/CD 部署流水线 / Deployment pipeline**：新增 [.github/workflows/deploy.yml](.github/workflows/deploy.yml)，
  在 CI 全绿后通过 SSH 推送式发布；服务器无需访问 GitHub。
  Added the SSH-push deploy workflow, triggered only after CI passes; the server never needs GitHub access.
- **部署脚本族 / Deploy scripts**（[deploy/scripts/](deploy/scripts/)）：`preflight`（环境预检+自动安装）、
  `deploy`（原子切换 + 失败自动回滚）、`rollback`（手动回滚）、`render_nginx`、`ssl_check`（证书申请/到期续签）、
  `health_check`（部署后全链路检查）。
  Preflight, deploy (atomic switch + auto-rollback), rollback, Nginx render, SSL issue/renew, and post-deploy health checks.
- **配置模板 / Templates**：[Nginx 模板](deploy/nginx/a-platform.conf.tpl)、
  [systemd 单元模板](deploy/systemd/a-platform.service.tpl)、[.env.example](deploy/.env.example)。
- **运维接口 / Ops endpoints**：`GET /api/v1/health`（含数据库、搜索索引依赖状态与版本号）、`GET /api/v1/version`。
  `GET /api/v1/health` (with DB + search-index dependency status and version) and `GET /api/v1/version`.
- **代码规范 / Linting**：后端 ruff（PEP 8）、前端 ESLint，均接入 CI。
  ruff (backend, PEP 8) and ESLint (frontend), both wired into CI.
- **类型继承体系 / Type hierarchy**：后端模型 Mixin（`IdMixin` / `TimestampMixin` / `NamedSlugMixin`）与 schema 基类 `ORMModel`；
  前端基础接口 `Entity`。
  Backend model mixins + `ORMModel` schema base; frontend `Entity` base interface.
- **双语文档中心 / Bilingual docs hub**：新增 [docs/](docs/README.md) 索引、[ARCHITECTURE](docs/ARCHITECTURE.md)、
  [DEPLOYMENT](docs/DEPLOYMENT.md)（含上线前准备清单）。
- **本变更日志 / This changelog**。

### 变更 · Changed

- **API 前缀 / API prefix**：所有业务接口统一挂载于 `/api/v1`，版本前缀集中在 `main.py` 管理。
  All endpoints unified under `/api/v1`, mounted centrally in `main.py`.
- **端口 / Ports**：后端 `8000 → 18321`，前端 `5173 → 15173`。
- **后端网址可配置 / Configurable backend URL**：前端通过 `VITE_API_BASE` 指向后端，默认 `/api/v1`（开发由 Vite 代理）。
- **站点地图 / Sitemap**：改为后端动态生成 `/sitemap.xml`；`robots.txt` 保持前端静态资源。
  `/sitemap.xml` is now generated dynamically by the backend; `robots.txt` stays a static frontend asset.
- **社区文档归类 / Docs relocation**：`CONTRIBUTING` / `CODE_OF_CONDUCT` / `SECURITY` 迁入 `docs/` 并双语化。

### 修复 · Fixed

- 搜索结果高亮使用用户原始关键词，避免高亮分词后的片段。
  Search snippets now highlight the user's original terms rather than tokenized fragments.

## [0.1.0] - 2026-06-11 — 初始平台 / Initial platform

### 新增 · Added

- **后端 / Backend**（FastAPI）：可解释搜索（BM25 + 运算符 + 纠错 + 补全，无 PageRank/行为信号）、
  三层内容审核（可解释规则 + 编辑 + 专家）、完全付费制（单篇购买 + 全站/专题订阅 + 付费墙）、
  分类/标签/专题多维索引与编辑标注的知识图谱、JWT 认证与角色权限。
  Explainable search, three-tier review, fully-paid model with paywall, taxonomy + knowledge graph, JWT auth.
- **前端 / Frontend**（React + TypeScript）：国际化（中/英）、暗亮主题、阅读模式、付费预览、
  搜索/浏览/详情/图谱/账户/投稿页面。
  i18n (zh/en), dark/light themes, reading mode, paywall preview, full page set.
- **测试 / Tests**：前后端单元测试覆盖率均 ≥ 90%，CI 强制门禁。
  Front/back unit tests at ≥ 90% coverage, enforced in CI.
- **SEO**：允许各大搜索引擎抓取的 `robots.txt` 与站点地图。
  `robots.txt` welcoming major search engines, plus a sitemap.
- **许可证 / License**：PolyForm Noncommercial 1.0.0（仅限非商业用途）。

[Unreleased]: https://github.com/a-platform/a-platform/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/a-platform/a-platform/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/a-platform/a-platform/releases/tag/v0.1.0
