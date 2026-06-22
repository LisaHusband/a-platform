# PRD：可信内容采集与投稿平台（Developer PRD）

## 1. 背景与目标

本项目旨在构建一个以“主动探索”为核心的高质量内容平台。平台内容来源分为两类：

1. **站外采集**：通过爬虫采集网站、博客、公开内容页等；
2. **站内投稿**：支持用户上传/提交内容，来源可以是网页、博客链接、文档、多媒体文件或结构化内容。

平台不做社交化信息流，不做个性化推荐，不依赖用户关系链。内容通过分类索引、主题标签和结构化目录展示。

### 核心目标

* 采集公开可访问的高质量内容，并严格遵守 robots.txt。
* 支持用户上传内容、提交链接内容、补充元数据。
* 将内容结构化、分类化、可检索化。
* 为后续专家审核、质量评级、订阅收费提供基础能力。

### 非目标

* 不做评论区、私信、关注、粉丝体系。
* 不做推荐算法、个性化 feed、社交传播链。
* 不爬取需要登录、绕过限制、反爬、付费墙的内容。

---

## 2. 产品范围

### 2.1 第一阶段范围（MVP）

* 爬虫抓取公开网页正文、标题、摘要、作者、发布时间、站点信息。
* 读取并遵守 robots.txt。
* 站内投稿：

  * 提交网页 URL
  * 粘贴正文
  * 上传文件（如 PDF / DOCX / 图片 / 视频可选）
* 内容入库、去重、基础分类、标签管理。
* 管理端审核、通过/拒绝、人工修正分类。
* 前台按分类目录浏览、搜索、查看详情页。

### 2.2 第二阶段范围（可扩展）

* 更完善的语义分类与知识图谱关系。
* 多语言抓取与多媒体转写。
* 专家轮审工作流。
* 付费专题订阅与单篇付费。
* 对外 API / RSS / 导出能力。

---

## 3. 关键原则

### 3.1 合规优先

* 仅抓取公开可访问内容。
* 严格遵守 robots.txt。
* 尊重站点的 crawl-delay、disallow、sitemap 等声明。
* 不抓取登录态页面、验证码页面、反爬绕过内容。
* 不采集明确禁止抓取的内容。

### 3.2 内容优先

* 不做流量导向排序。
* 不以点击率作为核心展示逻辑。
* 以分类、主题、质量等级、来源可信度为主要组织方式。

### 3.3 可解释性

* 分类逻辑、审核状态、质量评分需可追踪、可解释。
* 系统尽量采用明确规则与可审计策略。

---

## 4. 用户角色

### 4.1 游客/订阅用户

* 浏览分类目录
* 搜索内容
* 查看详情页
* 订阅专题或内容

### 4.2 投稿用户

* 提交 URL
* 上传文件或粘贴内容
* 补充标题、摘要、标签、来源说明

### 4.3 编辑/审核员

* 审核内容是否合规
* 修正分类与标签
* 标记质量等级
* 拒绝低质/违规内容

### 4.4 管理员

* 配置爬虫站点列表
* 配置 robots 策略与抓取频率
* 管理分类体系
* 管理用户、权限、收费规则

---

## 5. 功能需求

## 5.1 爬虫系统（Spider/Crawler）

### 5.1.1 站点发现

* 支持手动录入站点域名、起始 URL、站点地图地址。
* 支持通过 sitemap.xml 发现页面。
* 支持从已抓取内容中发现同域新链接。

### 5.1.2 robots.txt 合规

系统必须在抓取前执行以下步骤：

1. 请求目标域名 robots.txt；
2. 解析 User-agent 对应规则；
3. 校验目标 URL 是否允许抓取；
4. 如 robots.txt 中声明 crawl-delay，则抓取任务应遵守最小间隔；
5. 若某页面被 disallow，则不得抓取。

### 5.1.3 抓取内容范围

支持抓取以下公开内容字段：

* 页面标题
* 正文文本
* 摘要/描述
* 作者
* 发布时间
* 更新时间
* 标签/分类（站点原生）
* 封面图/缩略图（如公开可访问）
* 页面 URL
* 来源站点域名

### 5.1.4 内容提取

* 需支持 HTML 结构清洗，提取正文。
* 去除导航、页脚、广告、脚本、样式、无关模块。
* 保留图片、视频、音频等多媒体资源的引用或元信息。
* 对长文需支持分段结构提取。

### 5.1.5 去重

* URL 级去重：同一 URL 不重复入库。
* 内容指纹去重：正文相似度过高时标记为重复候选。
* 支持跨域重复检测（可配置阈值）。

### 5.1.6 失败重试

* 网络超时、DNS 错误、临时 5xx 应自动重试。
* 失败任务进入死信队列或重试队列。
* 同一域名失败率过高时自动降速。

### 5.1.7 抓取策略

* 默认限速抓取。
* 支持按域名配置并发数、QPS、抓取窗口。
* 支持黑名单/白名单域名。

---

## 5.2 用户投稿系统

### 5.2.1 投稿方式

支持以下投稿入口：

* 提交网页 URL
* 粘贴完整正文
* 上传文件（如 PDF、DOCX、TXT、图片、音频、视频）
* 可选：提交站点 RSS / RSS Feed

### 5.2.2 投稿字段

投稿时至少包含：

* 内容标题
* 内容正文 / 文件 / URL
* 来源类型（网页/博客/文件/多媒体）
* 作者名（可选）
* 来源站点（可选）
* 简介/摘要（可选）
* 主题分类（至少一项）
* 标签（可选）

### 5.2.3 投稿后处理

* 自动解析内容并生成预览。
* 自动抽取元数据。
* 自动进行重复检测。
* 自动进入审核队列。

### 5.2.4 投稿权限

* 支持游客投稿（可选，建议后期开放）。
* 支持注册用户投稿。
* 支持付费用户优先投稿或更高额度。

---

## 5.3 审核与质量控制

### 5.3.1 审核状态

* Draft：草稿
* Pending Review：待审核
* Approved：已通过
* Rejected：已拒绝
* Needs Fix：需修改
* Archived：归档

### 5.3.2 审核动作

* 通过
* 拒绝
* 修改分类
* 修改标签
* 标记低质
* 标记重复
* 标记来源异常

### 5.3.3 审核规则

系统需支持基础规则引擎，例如：

* 文本过短拒绝
* 标题与正文不匹配拒绝
* 重复内容进入人工确认
* 明显广告内容拒绝
* 不合规 URL 拒绝

---

## 5.4 分类索引系统

### 5.4.1 分类体系

* 支持一级分类、二级分类、专题标签。
* 支持一篇内容归属多个分类。
* 支持管理员维护分类树和标签词表。

### 5.4.2 索引规则

* 内容必须至少绑定一个分类。
* 支持站点维度、主题维度、作者维度、时间维度索引。
* 支持多媒体内容索引（图片、音频、视频、文件）。

### 5.4.3 展示方式

* 分类目录页
* 专题页
* 来源页
* 作者页
* 标签页
* 搜索结果页

---

## 5.5 搜索能力

### 5.5.1 基础搜索

* 按标题、正文、作者、标签、来源站点搜索。
* 支持关键词高亮。
* 支持筛选：分类、来源、时间、内容类型、审核状态。

### 5.5.2 搜索结果排序

不使用个性化推荐。排序依据可包括：

* 相关性
* 分类匹配度
* 质量等级
* 发布时间
* 来源信誉等级

---

## 5.6 多媒体支持

### 5.6.1 支持内容类型

* 纯文本
* 图文网页
* 图片集
* 音频
* 视频
* PDF / DOCX 等文档

### 5.6.2 处理能力

* 提取文件元信息。
* 生成预览图/缩略图。
* 支持转写/摘要（后续可扩展）。

---

## 6. 数据模型（建议）

### 6.1 Content

* id
* title
* summary
* body
* content_type
* source_type
* source_url
* source_domain
* author_name
* publish_time
* fetch_time
* language
* status
* quality_score
* checksum
* created_at
* updated_at

### 6.2 Category

* id
* parent_id
* name
* slug
* description
* sort_order
* status

### 6.3 Tag

* id
* name
* slug
* type
* status

### 6.4 ContentCategory

* content_id
* category_id

### 6.5 ContentTag

* content_id
* tag_id

### 6.6 CrawlTask

* id
* domain
* url
* priority
* status
* retry_count
* next_run_at
* last_error

### 6.7 ReviewRecord

* id
* content_id
* reviewer_id
* action
* comment
* before_status
* after_status
* created_at

---

## 7. 技术架构建议

### 7.1 推荐模块划分

* Crawler Service
* robots.txt Parser
* Content Extraction Service
* Dedup Service
* Ingestion API
* Review/Admin Service
* Search Index Service
* Frontend Web/App
* File Storage Service

### 7.2 推荐技术点

* 爬虫队列：Redis / RabbitMQ / Kafka 任选其一
* 文本抽取：基于规则 + DOM 清洗
* 搜索：Elasticsearch / OpenSearch
* 文件存储：S3 兼容对象存储
* 任务调度：Cron / Celery / Quartz / 自研调度器

---

## 8. 合规要求

### 8.1 爬虫合规

* 必须读取 robots.txt。
* 必须遵守 crawl-delay 与 disallow。
* 不得绕过访问限制。
* 不得抓取明确禁止的内容。

### 8.2 版权与内容来源

* 标注内容来源。
* 对转载、摘要、引用做明显标记。
* 对用户上传内容保留来源声明。
* 支持权利人下架请求与投诉处理流程。

### 8.3 隐私与安全

* 不采集敏感个人信息。
* 不展示用户间私聊或社交关系。
* 不公开内部审核信息给普通用户。

---

## 9. 非功能需求

### 9.1 性能

* 支持高并发抓取任务调度。
* 内容检索响应时间应可控。
* 列表页与详情页需快速加载。

### 9.2 可扩展性

* 可按域名横向扩展爬虫。
* 可按分类/专题扩展内容库。
* 可支持未来专家审核和付费订阅。

### 9.3 可维护性

* 规则、分类、黑白名单需后台可配置。
* 审核与抓取日志可追踪。
* 错误与异常可观测。

### 9.4 可审计性

* 所有抓取与审核动作需要留日志。
* robots 判断结果要保留证据链。
* 内容变更需有版本记录。

---

## 10. 页面清单

### 10.1 用户端

* 首页（分类入口）
* 分类页
* 专题页
* 搜索页
* 内容详情页
* 投稿页
* 登录/注册页
* 订阅页（后续）

### 10.2 管理端

* 内容审核页
* 抓取任务页
* 域名管理页
* 分类管理页
* 标签管理页
* 用户管理页
* 投诉/下架处理页

---

## 11. 验收标准

### 11.1 爬虫合规验收

* 目标 URL 若在 robots.txt 禁止列表中，则系统不得抓取。
* crawl-delay 配置生效。
* 抓取日志可回溯。

### 11.2 投稿验收

* 用户可提交 URL、正文、文件。
* 投稿后进入审核队列。
* 审核后可在前台展示。

### 11.3 分类验收

* 内容可归属多个分类。
* 前台可按分类浏览。
* 分类与标签可后台维护。

### 11.4 搜索验收

* 可按关键词搜索内容。
* 可按分类、时间、来源筛选。

---

## 12. 里程碑建议

### Phase 1：MVP

* 爬虫基础版
* robots.txt 合规
* 投稿与审核
* 分类目录
* 搜索

### Phase 2：增强版

* 多媒体处理
* 去重优化
* 质量评分
* 专题体系

### Phase 3：商业化版

* 专家轮审
* 付费专题
* 订阅体系
* API 输出

---

## 13. 风险与对策

### 风险 1：版权与合规风险

对策：严格遵守 robots.txt，标注来源，提供下架机制。

### 风险 2：内容质量不稳定

对策：引入审核规则、人工编辑、专家轮审。

### 风险 3：冷启动慢

对策：先聚焦高质量垂直领域与高主动性用户。

### 风险 4：分类体系膨胀

对策：采用图结构标签与可维护分类树。

---

## 14. 待确认问题

* 是否允许抓取仅部分公开、但 robots 允许的站点全文？
* 是否允许用户提交第三方内容镜像？
* 是否支持多语言内容与跨语种索引？
* MVP 是否先只做文本/网页，暂不做视频音频转写？
* 审核是否先由人工为主，还是先以规则引擎为主？

---

## 15. 一句话总结

本项目是一个遵守 robots.txt、支持用户投稿、以人工/规则审核为核心、通过分类索引展示的高质量内容基础设施，而不是社交平台或推荐流产品。

---

## 16. 回归反思：从创新到模仿，再到回归创新 · Reflection: From Innovation to Imitation and Back

> *本章节为项目发展中一次重要的自我校正记录。*

### 16.1 初始阶段：清晰的创新蓝图

项目的起点是明确的 —— 构建一个"去算法化、非社交化、主动探索型的高质量数字内容基础设施"。需求文档（`需求整理.md`）中明确列出了五大核心理念：

1. **去推荐算法** — 不使用个性化推荐、Feed 流、用户画像
2. **强分类索引体系** — 以分类/标签/Topic/知识图谱组织内容
3. **高质量内容优先** — 拒绝 AI 水文、标题党、情绪化内容
4. **完全付费制** — 不依赖广告，不追求海量 DAU
5. **非社交化** — 不提供私信、评论区社交、点赞排行、粉丝系统、社交关系链

这些原则构成了项目的核心护城河：**内容可信度 + 信息架构能力**，而非推荐算法或用户规模。

### 16.2 滑向模仿：贴吧式社区的引入

然而，在后续开发中，项目引入了**贴吧式社区功能**（Board / Thread / Post / Like），具体表现为：

- **吧（Board）**：类似贴吧的板块组织
- **主题帖（Thread）**：含标题+正文的讨论帖，附带浏览数、回复数、点赞数
- **楼层回复（Post）**：楼层式回帖，支持点赞
- **社区管理功能**：置顶（pin）、加精（feature）、锁定（lock）
- **工作台版务入口**：社区版务（moderate）、板块管理（boards）

这直接违背了需求文档中明确列出的禁令："**不提供评论区社交、点赞排行、粉丝系统、社交关系链、社区情绪互动**"。

### 16.3 为何会走到这一步：心路历程分析

本意并非模仿。初始阶段有大量积极或消极的反馈，项目方向清晰。然而：

1. **执行周期拉长**：由于注意力分散到娱乐或其他事务，项目执行周期被显著拉长。反馈的影响逐渐消减，最初对创新方向的坚定信念在时间流逝中被稀释。

2. **惰性增强**：当创新路径遇到困难（如冷启动难、内容供给稀缺、审核成本高），而熟悉的社交化模式（贴吧、论坛）在记忆中更易检索、更容易实现时，惰性推动开发者滑向了模仿。

3. **反馈真空**：长时间缺乏外部反馈的矫正，使得"做一个社区板块"这种看似无害的功能添加变得理所当然。热度和点赞是熟悉的交互模式，实现它们比坚守"去社交化"更需要克制力。

4. **消极反馈的唤醒**：当后续消极反馈出现，明确指出社区功能与初始宗旨的矛盾时，才意识到已经偏离了航线。这正是反思和纠正的契机。

### 16.4 纠正行动（v0.2.1）

作为对上述偏差的回应，执行以下纠正：

- **从后端的 models.py 中移除** Board、Thread、Post、Like 模型及其关联
- **从后端的路由中移除** `community_router.py` 及对应挂载
- **从前端的 App.tsx 中移除** `/community`、`/community/:slug`、`/thread/:id` 路由
- **从前端的 API 类型中移除** Board、ThreadCard、ThreadDetail、CommunityPost、PosterRef
- **从前端的 i18n 中移除** 所有社区相关文案（中英文）
- **从工作台中移除** 社区版务和板块管理入口
- **从前端的角色能力矩阵中移除** moderate 和 boards 能力

### 16.5 教训

1. **原则写在纸上比记在心里更可靠**：需求文档中已明确列出非目标，但执行中仍需反复对照。

2. **短周期迭代比长周期拉锯更安全**：执行周期越长，初始信念越容易被消磨，惯性越容易将项目带偏。

3. **困难是试金石**：创新路径的困难（如冷启动）不应成为滑向模仿的借口。模仿路径看似更容易，实则背离了项目立身之本。

4. **消极反馈是礼物**：当有声音指出方向偏差时，应当感谢这些反馈 —— 它们帮助项目在彻底偏离之前刹车。

### 16.6 英文摘要 · English Abstract

> The project's original vision was clear: a non-social, recommendation-free, exploration-driven high-quality content infrastructure. Five core principles were explicitly documented, including "no social features — no comments, no likes, no follower systems."
>
> However, during development, Tieba-style community features (boards, threads, post replies, likes, pin/feature/lock management) were introduced — directly contradicting the documented principles. This happened not out of intent, but due to a prolonged execution cycle where initial feedback faded, inertia grew, and the comfort of familiar social patterns (easier to implement) overtook the discipline of innovation.
>
> Negative feedback flagged the inconsistency, prompting this correction. The community features have been surgically removed from backend models, routes, frontend routes, API types, i18n strings, workbench entries, and the role capability matrix. The lesson: principles written down must be revisited during execution; shorter iteration cycles prevent drift; difficulty in the innovative path is not an excuse to slide into imitation.
