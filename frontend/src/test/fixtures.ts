import {
  Board,
  Category,
  CommunityPost,
  ContentCard,
  ContentDetail,
  CrawlSite,
  CrawlTask,
  GraphOut,
  Named,
  Page,
  PaymentOrder,
  SearchOut,
  Takedown,
  ThreadCard,
  ThreadDetail,
  Topic,
  User,
} from "../api";

/** Wrap items in a single-page envelope (mirrors backend Page[T]). */
export function page<T>(items: T[], total = items.length): Page<T> {
  return { items, total, page: 1, page_size: 20, has_more: total > items.length };
}

// Names are deliberately distinct from role labels (读者/编辑/作者) so tests can
// assert on the display name without colliding with the role chip.
export const reader: User = {
  id: 1,
  email: "reader@a.dev",
  name: "读者小明",
  role: "reader",
  balance: 1000,
};
export const editor: User = { ...reader, id: 3, name: "编辑小李", role: "editor" };
export const author: User = { ...reader, id: 4, name: "作者小陈", role: "author" };

export const tag: Named = { id: 1, slug: "llm", name_zh: "大模型", name_en: "LLM" };
export const topic: Topic = {
  id: 1,
  slug: "ai-infra",
  name_zh: "AI 基础设施",
  name_en: "AI Infrastructure",
  description_zh: "专题描述",
  description_en: "topic desc",
};
export const category: Category = {
  id: 2,
  slug: "ai-systems",
  name_zh: "AI 系统",
  name_en: "AI Systems",
  parent_id: 1,
};
export const rootCategory: Category = {
  id: 1,
  slug: "tech",
  name_zh: "技术",
  name_en: "Technology",
  parent_id: null,
};

export const card: ContentCard = {
  id: 1,
  title: "测试内容标题",
  subtitle: "副标题",
  abstract: "这是摘要内容。",
  lang: "zh",
  content_type: "article",
  price: 12,
  status: "published",
  reading_minutes: 8,
  published_at: "2026-06-01T00:00:00Z",
  author: { id: 4, name: "研究员" },
  category,
  tags: [tag],
  topics: [topic],
  source_type: "manual",
  source_url: "",
  source_domain: "",
  author_name: "",
  quality_score: 0,
};

export const freeCard: ContentCard = { ...card, id: 2, price: 0, title: "免费内容" };

export const lockedDetail: ContentDetail = {
  ...card,
  body: null,
  sources: "",
  has_access: false,
  preview: "# 预览片段\n\n这是正文预览。",
};

export const unlockedDetail: ContentDetail = {
  ...card,
  body: "# 正文\n\n完整的正文内容在此。",
  sources: "[1] https://example.com",
  has_access: true,
  preview: "# 正文",
};

export const searchOut: SearchOut = {
  query: "测试",
  total: 1,
  page: 1,
  page_size: 10,
  took_ms: 1.2,
  did_you_mean: null,
  hits: [
    {
      content: card,
      score: 8.5,
      snippet: "这是 <mark>测试</mark> 片段",
      explanation: ["term '测试': bm25=8.50"],
    },
  ],
};

export const graph: GraphOut = {
  nodes: [
    { id: 1, title: "节点一", content_type: "article", topic_slugs: ["ai-infra"] },
    { id: 2, title: "节点二", content_type: "report", topic_slugs: ["ai-infra"] },
  ],
  edges: [{ src: 1, dst: 2, relation: "related" }],
};

// --- payments / community fixtures ---
export const order: PaymentOrder = {
  id: 1,
  kind: "content",
  ref: "1",
  amount: 12,
  method: "alipay",
  status: "created",
  provider_txn: "alipay_sandbox_1",
  created_at: "2026-06-01T00:00:00Z",
};

export const board: Board = {
  id: 1,
  slug: "ai-infra",
  name: "AI 基础设施吧",
  description: "讨论 AI 基础设施",
  thread_count: 2,
};

export const threadCard: ThreadCard = {
  id: 1,
  board_id: 1,
  title: "H100 性价比讨论",
  author: { id: 1, name: "读者", role: "reader" },
  views: 10,
  reply_count: 2,
  like_count: 3,
  is_pinned: 1,
  is_locked: 0,
  is_featured: 1,
  created_at: "2026-06-01T00:00:00Z",
  last_activity_at: "2026-06-02T00:00:00Z",
};

export const threadDetail: ThreadDetail = { ...threadCard, body: "# 楼主帖\n\n正文内容。" };

export const post: CommunityPost = {
  id: 5,
  floor: 2,
  body: "二楼回复",
  author: { id: 3, name: "编辑", role: "editor" },
  like_count: 1,
  created_at: "2026-06-02T00:00:00Z",
};

// --- crawl / admin / takedown fixtures ---
export const crawlSite: CrawlSite = {
  id: 1,
  domain: "example.com",
  start_url: "https://example.com/",
  sitemap_url: "",
  allowed: 1,
  is_blacklisted: 0,
  crawl_delay: 1,
  max_concurrency: 2,
};

export const crawlTask: CrawlTask = {
  id: 1,
  domain: "example.com",
  url: "https://example.com/a",
  status: "done",
  retry_count: 0,
  robots_decision: "allowed",
  last_error: "",
  content_id: 1,
  created_at: "2026-06-01T00:00:00Z",
};

export const takedown: Takedown = {
  id: 1,
  content_id: 1,
  requester_email: "x@y.z",
  reason: "版权问题",
  status: "open",
  resolution: "",
  created_at: "2026-06-01T00:00:00Z",
};

export const crawledCard: ContentCard = {
  ...card,
  id: 9,
  title: "抓取内容标题",
  source_type: "crawl",
  source_url: "https://example.com/a",
  source_domain: "example.com",
  author_name: "原作者甲",
};
