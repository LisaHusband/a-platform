# 贡献指南 · Contributing Guide

感谢你愿意为 A-PLATFORM 做出贡献！
Thank you for your interest in contributing to A-PLATFORM!

本项目是 **去算法化、非社交化、高信噪比** 的内容平台。贡献前请阅读 [需求整理](需求整理.md) 以理解平台理念——任何引入推荐算法、社交化、情绪化机制的改动都不会被接受。
This project is a content platform that is **algorithm-free, non-social, and high signal-to-noise**. Before contributing, please read the [Requirements](需求整理.md) to understand its philosophy — any change that introduces recommendation algorithms, social features, or engagement-bait mechanics will not be accepted.

> 官网 / Website: https://www.a-platform.tech
> 许可 / License: [PolyForm Noncommercial 1.0.0](../LICENSE) — **仅限非商业用途 / non-commercial use only**.
> 提交贡献即表示你同意你的贡献以相同许可证发布。
> By contributing, you agree that your contributions are licensed under the same license.

## 行为准则 · Code of Conduct

参与本项目须遵守 [行为准则](CODE_OF_CONDUCT.md)。
Participation is governed by our [Code of Conduct](CODE_OF_CONDUCT.md).

## 分支模型（Git Flow） · Branching Model (Git Flow)

| 分支 / Branch | 用途 / Purpose |
|---|---|
| `main` | 生产可发布代码，受保护 / Production-ready, protected; merges only from `release/*` and `hotfix/*` |
| `develop` | 集成分支，日常合并目标 / Integration branch, default merge target |
| `feature/<name>` | 新功能，从 `develop` 切出 / Features, branched from `develop` |
| `release/<version>` | 发布准备，合入 `main` 与 `develop` / Release prep, merged into `main` and `develop` |
| `hotfix/<name>` | 生产紧急修复，从 `main` 切出 / Production hotfix, branched from `main` |

CI 会在向 `main` / `develop` / `release/*` / `hotfix/*` 推送或发起 PR 时运行 lint、构建与测试。
CI runs lint, build and tests on push/PR to `main` / `develop` / `release/*` / `hotfix/*`.

## 开发流程 · Development Workflow

1. Fork 并克隆仓库，从 `develop` 切出 `feature/<简短描述>` 分支。
   Fork and clone, then branch `feature/<short-desc>` from `develop`.
2. 按下方「本地开发」配置环境。
   Set up your environment as described in *Local development* below.
3. 编写代码并补充测试——新增逻辑必须带测试，整体覆盖率不得低于 **90%**。
   Write code **with tests** — new logic must be tested and overall coverage must stay ≥ **90%**.
4. 本地跑通 lint、`pytest`（后端）与 `npm test`（前端）。
   Locally pass lint, `pytest` (backend) and `npm test` (frontend).
5. 在 [CHANGELOG.md](../CHANGELOG.md) 的 `[Unreleased]` 段记录用户可见的变更。
   Record user-facing changes under `[Unreleased]` in [CHANGELOG.md](../CHANGELOG.md).
6. 提交（遵循下方提交规范），推送并向 `develop` 发起 Pull Request。
   Commit (per the convention below), push, and open a PR against `develop`.
7. 通过 CI 与至少一名维护者 Review 后合并。
   Merge after CI passes and at least one maintainer approves.

### 本地开发 · Local development

```bash
# 后端 / Backend
cd backend
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt -r requirements-dev.txt
.venv/bin/python run.py            # http://127.0.0.1:18321

# 前端 / Frontend
cd frontend
npm install
npm run dev                        # http://127.0.0.1:15173
```

## 提交规范 · Commit Convention

采用 Conventional Commits / We use Conventional Commits:

```
<type>(<scope>): <subject>
```

`type`: `feat` / `fix` / `docs` / `test` / `refactor` / `perf` / `chore` / `ci`.
示例 / Examples: `feat(search): 支持 author: 运算符`, `test(billing): cover subscription expiry`.

## 代码规范 · Code Style

- **后端 / Backend**：Python 3.13 + 类型注解，遵循 PEP 8，由 **ruff** 强制（`ruff check app tests`）。
  Python 3.13 with type hints, PEP 8 enforced by **ruff** (`ruff check app tests`).
- **前端 / Frontend**：TypeScript `strict`，由 **ESLint** 强制（`npm run lint`）；`npm run build` 必须零类型错误；文案一律走 i18n，不硬编码中英文。
  TypeScript `strict`, enforced by **ESLint** (`npm run lint`); `npm run build` must be type-error free; all UI strings go through i18n, never hard-coded.
- 不要提交 / Do not commit: `.venv/`, `node_modules/`, `*.db`, `*.log`, build output (see [.gitignore](../.gitignore)).

## 测试要求 · Testing Requirements

- 后端 / Backend: `cd backend && .venv/bin/pytest`（`--cov-fail-under=90`，配置见 [pyproject.toml](../backend/pyproject.toml)）。
- 前端 / Frontend: `cd frontend && npm test`（coverage thresholds = 90，配置见 [vitest.config.ts](../frontend/vitest.config.ts)）。
- 新功能与 Bug 修复都应附带测试；修 Bug 时优先写一个能复现问题的失败测试。
  Both features and bug fixes need tests; for a bug, first write a failing test that reproduces it.

## 报告问题 / 提需求 · Reporting Issues / Requests

请使用 Issue 模板 / Please use the issue templates:
[Bug 报告 / Bug report](../.github/ISSUE_TEMPLATE/bug_report.md) ·
[功能请求 / Feature request](../.github/ISSUE_TEMPLATE/feature_request.md).

安全漏洞请勿公开提交 Issue，按 [SECURITY.md](SECURITY.md) 私下披露。
Do not file public issues for security vulnerabilities; disclose privately per [SECURITY.md](SECURITY.md).
