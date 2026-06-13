export interface Named {
  id: number;
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
export interface User {
  id: number;
  email: string;
  name: string;
  role: string;
}
export interface ContentCard {
  id: number;
  title: string;
  subtitle: string;
  abstract: string;
  lang: string;
  content_type: string;
  price: number;
  status: string;
  reading_minutes: number;
  published_at: string | null;
  author: { id: number; name: string } | null;
  category: Category | null;
  tags: Named[];
  topics: Named[];
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
export interface Subscription {
  id: number;
  plan: string;
  topic: Topic | null;
  started_at: string;
  expires_at: string;
}
export interface Purchase {
  id: number;
  content: ContentCard;
  price_paid: number;
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
