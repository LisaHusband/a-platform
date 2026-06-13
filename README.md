# A-PLATFORM

去算法化、非社交化、主动探索型的高质量内容平台。前后端分离：FastAPI (Python) + React (TypeScript)。
需求来源：[docs/需求整理.md](docs/需求整理.md)。

## 快速启动

```bash
# 后端（端口 18321，首次启动自动建库 + 注入演示数据）
cd backend
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/uvicorn app.main:app --port 18321

# 前端（端口 15173，/api/v1 代理到后端）
cd frontend
npm install
npm run dev
```

打开 http://localhost:15173 。API 文档见 http://localhost:18321/docs 。

所有后端接口统一挂在 `/api/v1` 前缀下（如 `/api/v1/auth/login`、`/api/v1/search`）；
`/sitemap.xml` 例外，按协议位于站点根路径。

### 后端网址配置

前端通过 `VITE_API_BASE` 指定后端网址，开发环境默认 `/api/v1`（由 Vite 代理到本地后端）。
生产构建时设置为真实网址，例如：

```bash
# frontend/.env.production
VITE_API_BASE=https://www.a-platform.tech/api/v1
```

### 生产部署（反向代理示例）

```nginx
location = /sitemap.xml { proxy_pass http://backend:18321; }  # 动态站点地图
location /api/v1/        { proxy_pass http://backend:18321; }  # 后端接口
location /               { try_files $uri /index.html; }       # 前端 SPA + robots.txt
```

演示账号（密码均为 `password123`）：
`reader@a.dev` / `author@a.dev` / `editor@a.dev` / `expert@a.dev` / `admin@a.dev`
（reader 自带"可信系统"专题订阅，用于演示订阅解锁。）

## 功能映射

| 需求 | 实现 |
|---|---|
| 去推荐算法 | 无 Feed/热度/个性化；搜索仅用 BM25 文本相关性 + 显式元数据，每条结果附打分解释（`为什么排在这里？`） |
| 搜索（无 PageRank） | 倒排索引 + BM25 字段加权（标题×3/摘要×2/正文×1），中文二元分词；运算符 `"短语" -排除 tag: category: topic: type: lang: author: before: after:`；拼写纠错（您是不是要找）；自动补全；排序可切换（相关性/最新/最早/标题） |
| 强分类索引 | 分类树（含子类聚合）、标签、专题（Topic）多维索引，内容可多 Topic 归属 |
| 知识图谱 | 编辑显式标注的内容关联边（cites/related/follows/contrasts），SVG 可视化，可按专题筛选 |
| 三层审核 | Tier-1 可解释规则引擎（长度/标题党/广告/结构/引用，逐条 PASS/FAIL+扣分）→ Tier-2 编辑审核 → Tier-3 专家轮审，全部留审计记录 |
| 完全付费制 | 单篇购买 + 全站月订阅 + 专题订阅；未解锁仅展示摘要与正文预览（支付网关为 mock） |
| 非社交化 | 无评论/点赞/粉丝/私信；"相关内容"为编辑标注，非算法推荐 |
| 国际化 | 中/英全站切换（react-i18next），分类/标签/专题双语字段 |
| 暗亮主题 | CSS 变量主题，跟随系统偏好，可手动切换并持久化 |
| 阅读模式 | 沉浸排版（衬线字体、隐藏导航）、字号调节 |
| 内容类型 | 长文/研究报告/系列/视频/音频 |

## 结构

```
backend/app/
  main.py            FastAPI 入口（启动时建库、播种、建索引）
  models.py          User/Content/Category/Tag/Topic/Relation/Purchase/Subscription/ReviewEvent
  routers/           auth / contents / taxonomy / search / review / billing / sitemap
                     （均挂载于 /api/v1；sitemap 在站点根 /sitemap.xml）
  services/
    search_engine.py 可解释搜索（倒排索引+BM25+运算符+纠错+补全+高亮）
    rules.py         Tier-1 可解释审核规则
    access.py        付费墙访问控制
frontend/src/
  pages/             Home / Search / Browse / ContentPage / GraphPage / Account / Publish
  components/        Header / SearchBar(联想) / ContentCardView / Markdown(已消毒)
  i18n.ts            中英文案；context.tsx 主题+登录态
  api.ts             API_BASE（VITE_API_BASE，默认 /api/v1）+ 统一请求封装
```

## 许可证

本项目采用 **PolyForm Noncommercial License 1.0.0**，详见 [LICENSE](LICENSE)。

**仅限非商业用途。禁止一切商业使用**，包括但不限于：出售本软件、用其运营任何付费或营利性服务、
在营利性组织的商业活动中或为其利益使用本软件。教育、科研、个人学习、公益组织等非商业用途允许使用。
如需商业授权，请联系版权持有人。
