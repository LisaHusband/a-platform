# 架构与规范 · Architecture & Conventions

前后端分离：FastAPI (Python 3.13) + React (TypeScript)。
Separated front/back end: FastAPI (Python 3.13) + React (TypeScript).

## 目录结构 · Layout

```
backend/app/
  main.py            FastAPI 入口，挂载 /api/v1，启动时建库/播种/建索引
                     FastAPI entry; mounts /api/v1; seeds + indexes on startup
  database.py        引擎与会话（APLATFORM_DB 可覆盖库路径）
                     Engine & session (APLATFORM_DB overrides the DB path)
  models.py          ORM 模型与 Mixin 类型体系
                     ORM models and the mixin type hierarchy
  schemas.py         Pydantic 投影模型（ORMModel 基类）
                     Pydantic projection models (ORMModel base)
  routers/           auth / contents / taxonomy / search / review / billing / sitemap
  services/          search_engine（可解释搜索）/ rules（审核规则）/ access（付费墙）
frontend/src/
  api.ts             类型体系（Entity→Named→…）+ 请求封装（API_BASE）
                     Type hierarchy (Entity→Named→…) + request wrapper (API_BASE)
  context.tsx        主题与登录态 / theme & auth state
  i18n.ts            中英文案 / zh-en strings
  pages/ components/ 页面与组件 / pages & components
```

## 后端类型继承体系 · Backend Type Hierarchy

`models.py` 通过声明式 Mixin 复用公共列 / Reusable declarative mixins share common columns:

- `IdMixin` → 所有表的整型主键 `id` / integer PK on every table
- `TimestampMixin` → `created_at` 审计列 / audit timestamp
- `NamedSlugMixin(IdMixin)` → `slug` + `name_zh` + `name_en`，由 `Category` / `Tag` / `Topic` 继承 / inherited by taxonomy nodes

`schemas.py` 以 `ORMModel`（`from_attributes=True`）为投影基类，并形成投影继承链：`NamedOut → CategoryOut / TopicOut`，`ContentCard → ContentDetail`。
`schemas.py` uses `ORMModel` (`from_attributes=True`) as the projection base, with inheritance chains `NamedOut → CategoryOut / TopicOut` and `ContentCard → ContentDetail`.

## 前端类型继承体系 · Frontend Type Hierarchy

`api.ts` 中所有持久化记录继承 `Entity { id }`；taxonomy 类型继承 `Named extends Entity`；`ContentDetail extends ContentCard`。后端 / 前端类型一一对应。
In `api.ts`, all persisted records extend `Entity { id }`; taxonomy types extend `Named extends Entity`; `ContentDetail extends ContentCard`. Backend and frontend types mirror each other.

## 代码规范 · Lint & Style

| 端 / Side | 工具 / Tool | 命令 / Command |
|---|---|---|
| 后端 / Backend | ruff (PEP 8 + isort + pyupgrade + bugbear) | `ruff check app tests` |
| 前端 / Frontend | ESLint (typescript-eslint + react-hooks) | `npm run lint` |

配置见 [backend/pyproject.toml](../backend/pyproject.toml) 与 [frontend/eslint.config.js](../frontend/eslint.config.js)，均已接入 CI。
Configs live in [backend/pyproject.toml](../backend/pyproject.toml) and [frontend/eslint.config.js](../frontend/eslint.config.js); both run in CI.

## API 约定 · API Conventions

- 所有业务接口前缀 `/api/v1`；版本前缀集中在 `main.py` 统一挂载。
  All endpoints are prefixed `/api/v1`; the version prefix is mounted centrally in `main.py`.
- `/sitemap.xml` 按 sitemaps 协议位于站点根路径。
  `/sitemap.xml` lives at the site root per the sitemaps protocol.
- 前端经 `VITE_API_BASE` 指向后端网址，默认 `/api/v1`（开发由 Vite 代理）。
  The frontend points at the backend via `VITE_API_BASE`, defaulting to `/api/v1` (proxied by Vite in dev).
