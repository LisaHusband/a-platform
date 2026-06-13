import {
  Category,
  ContentCard,
  ContentDetail,
  GraphOut,
  Named,
  SearchOut,
  Topic,
} from "../api";

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
