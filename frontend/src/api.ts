// --- Type hierarchy -----------------------------------------------------------
// Every persisted record carries a numeric id; mirrors the backend IdMixin.
export interface Entity {
  id: number;
}
// A bilingual, slug-addressable taxonomy node; mirrors backend NamedSlugMixin.
export interface Named extends Entity {
  slug: string;
  name_zh: string;
  name_en: string;
}
export interface Category extends Named {
  parent_id: number | null;
}
export interface Topic extends Named {
  description_zh: string;
  description_en: string;
}
export interface User extends Entity {
  email: string;
  name: string;
  role: string;
  balance: number;
}
// Generic pagination envelope; mirrors backend Page[T].
export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  has_more: boolean;
}
export type AuthorRef = Pick<User, "id" | "name">;
export interface ContentCard extends Entity {
  title: string;
  subtitle: string;
  abstract: string;
  lang: string;
  content_type: string;
  price: number;
  status: string;
  reading_minutes: number;
  published_at: string | null;
  author: AuthorRef | null;
  category: Category | null;
  tags: Named[];
  topics: Named[];
  source_type: string;
  source_url: string;
  source_domain: string;
  author_name: string;
  quality_score: number;
}
export interface ContentDetail extends ContentCard {
  body: string | null;
  sources: string;
  has_access: boolean;
  preview: string;
}
export interface SearchHit {
  content: ContentCard;
  score: number;
  snippet: string;
  explanation: string[];
}
export interface SearchOut {
  query: string;
  total: number;
  page: number;
  page_size: number;
  took_ms: number;
  did_you_mean: string | null;
  hits: SearchHit[];
}
export interface GraphOut {
  nodes: { id: number; title: string; content_type: string; topic_slugs: string[] }[];
  edges: { src: number; dst: number; relation: string }[];
}
export interface Subscription extends Entity {
  plan: string;
  topic: Topic | null;
  started_at: string;
  expires_at: string;
}
export interface Purchase extends Entity {
  content: ContentCard;
  price_paid: number;
  created_at: string;
}

// --- Payments ---------------------------------------------------------------
export interface Wallet {
  balance: number;
  currency: string;
}
export type PaymentMethod = "balance" | "alipay" | "paypal";
export interface PaymentOrder extends Entity {
  kind: string;
  ref: string;
  amount: number;
  method: PaymentMethod;
  status: string;
  provider_txn: string;
  created_at: string;
}
export interface PaymentCreateOut {
  order: PaymentOrder;
  approval_url: string | null;
  qr_code: string | null;
}

// --- Crawling / admin / takedowns -------------------------------------------
export interface CrawlSite extends Entity {
  domain: string;
  start_url: string;
  sitemap_url: string;
  allowed: number;
  is_blacklisted: number;
  crawl_delay: number;
  max_concurrency: number;
}
export interface CrawlTask extends Entity {
  domain: string;
  url: string;
  status: string;
  retry_count: number;
  robots_decision: string;
  last_error: string;
  content_id: number | null;
  created_at: string;
}
export interface RobotsCheck {
  allowed: boolean;
  decision: string;
  crawl_delay: number | null;
  robots_url: string;
}
export interface ReviewRecord extends Entity {
  action: string;
  comment: string;
  before_status: string;
  after_status: string;
  reviewer: AuthorRef | null;
  created_at: string;
}
export interface Takedown extends Entity {
  content_id: number;
  requester_email: string;
  reason: string;
  status: string;
  resolution: string;
  created_at: string;
}

// Backend base URL. In dev defaults to "/api/v1" (proxied by Vite to the
// backend). In production set VITE_API_BASE to the full origin, e.g.
// "https://www.a-platform.tech/api/v1". Call sites pass base-relative paths
// like "/auth/me".
export const API_BASE = (import.meta.env.VITE_API_BASE ?? "/api/v1").replace(/\/$/, "");

const TOKEN_KEY = "ap.token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(t: string | null) {
  if (t) localStorage.setItem(TOKEN_KEY, t);
  else localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function api<T>(
  path: string,
  options: { method?: string; body?: unknown } = {},
): Promise<T> {
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  const res = await fetch(`${API_BASE}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const data = await res.json();
      detail = typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail);
    } catch {
      /* keep statusText */
    }
    throw new ApiError(res.status, detail);
  }
  return res.json() as Promise<T>;
}
