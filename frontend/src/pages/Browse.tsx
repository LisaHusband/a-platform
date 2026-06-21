import { FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { api, Category, ContentCard, Named, Page, Topic } from "../api";
import ContentCardView from "../components/ContentCardView";
import { useLocalName } from "../context";

const TYPES = ["article", "report", "series", "video", "audio"];
const PAGE_SIZE = 10;

export default function Browse() {
  const { t } = useTranslation();
  const name = useLocalName();
  const [params, setParams] = useSearchParams();
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<Named[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [data, setData] = useState<Page<ContentCard> | null>(null);
  const [error, setError] = useState("");
  const [kw, setKw] = useState(params.get("q") ?? "");

  const category = params.get("category") ?? "";
  const tag = params.get("tag") ?? "";
  const topic = params.get("topic") ?? "";
  const type = params.get("type") ?? "";
  const lang = params.get("lang") ?? "";
  const q = params.get("q") ?? "";
  const page = Number(params.get("page") ?? "1");

  useEffect(() => {
    Promise.all([
      api<Category[]>("/taxonomy/categories"),
      api<Named[]>("/taxonomy/tags"),
      api<Topic[]>("/taxonomy/topics"),
    ])
      .then(([c, ta, to]) => {
        setCategories(c);
        setTags(ta);
        setTopics(to);
      })
      .catch((e) => setError(String(e.message)));
  }, []);

  useEffect(() => {
    const qs = new URLSearchParams();
    if (category) qs.set("category", category);
    if (tag) qs.set("tag", tag);
    if (topic) qs.set("topic", topic);
    if (type) qs.set("content_type", type);
    if (lang) qs.set("lang", lang);
    if (q) qs.set("q", q);
    qs.set("page", String(page));
    qs.set("page_size", String(PAGE_SIZE));
    if (q) qs.set("sort", "relevance");
    api<Page<ContentCard>>(`/contents?${qs}`)
      .then(setData)
      .catch((e) => setError(String(e.message)));
  }, [category, tag, topic, type, lang, q, page]);

  // Changing a filter resets to page 1; goToPage navigates without resetting.
  function setFilter(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    next.set("page", "1");
    setParams(next);
  }
  function goToPage(n: number) {
    const next = new URLSearchParams(params);
    next.set("page", String(n));
    setParams(next);
  }

  function submitKeyword(e: FormEvent) {
    e.preventDefault();
    setFilter("q", kw.trim());
  }

  const roots = categories.filter((c) => c.parent_id === null);
  const items = data?.items ?? [];
  const pages = data ? Math.max(1, Math.ceil(data.total / data.page_size)) : 1;

  return (
    <div className="page container two-col">
      <aside className="sidebar">
        <h4>{t("browse.categories")}</h4>
        <a className={!category ? "active" : ""} onClick={() => setFilter("category", "")}>
          {t("browse.all")}
        </a>
        {roots.map((root) => (
          <div key={root.id}>
            <a
              className={category === root.slug ? "active" : ""}
              onClick={() => setFilter("category", root.slug)}
            >
              {name(root)}
            </a>
            {categories
              .filter((c) => c.parent_id === root.id)
              .map((child) => (
                <a
                  key={child.id}
                  className={`indent ${category === child.slug ? "active" : ""}`}
                  onClick={() => setFilter("category", child.slug)}
                >
                  {name(child)}
                </a>
              ))}
          </div>
        ))}
        <h4>{t("browse.topics")}</h4>
        {topics.map((tp) => (
          <a
            key={tp.id}
            className={topic === tp.slug ? "active" : ""}
            onClick={() => setFilter("topic", topic === tp.slug ? "" : tp.slug)}
          >
            {name(tp)}
          </a>
        ))}
        <h4>{t("browse.tags")}</h4>
        <div>
          {tags.map((tg) => (
            <a
              key={tg.id}
              className={`chip ${tag === tg.slug ? "active" : ""}`}
              style={{ margin: "2px 4px 2px 0", display: "inline-block" }}
              onClick={() => setFilter("tag", tag === tg.slug ? "" : tg.slug)}
            >
              #{name(tg)}
            </a>
          ))}
        </div>
      </aside>
      <main>
        <form className="toolbar" onSubmit={submitKeyword}>
          <input
            className="grow"
            placeholder={t("browse.keyword")}
            value={kw}
            onChange={(e) => setKw(e.target.value)}
            aria-label={t("browse.keyword")}
          />
          <label>
            {t("browse.type")}{" "}
            <select value={type} onChange={(e) => setFilter("type", e.target.value)}>
              <option value="">{t("browse.all")}</option>
              {TYPES.map((ty) => (
                <option key={ty} value={ty}>
                  {t(`browse.types.${ty}`)}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t("browse.lang")}{" "}
            <select value={lang} onChange={(e) => setFilter("lang", e.target.value)}>
              <option value="">{t("browse.all")}</option>
              <option value="zh">中文</option>
              <option value="en">English</option>
            </select>
          </label>
        </form>
        {data && (
          <p className="meta">{t("browse.count", { total: data.total })}</p>
        )}
        {error && <p className="error-msg">{t("common.error")}{error}</p>}
        {items.length === 0 && !error && <p>{t("browse.empty")}</p>}
        {items.map((c) => (
          <ContentCardView key={c.id} content={c} />
        ))}
        {data && pages > 1 && (
          <div className="pagination">
            <button disabled={page <= 1} onClick={() => goToPage(page - 1)}>
              ←
            </button>
            <span>
              {page} / {pages}
            </span>
            <button disabled={!data.has_more} onClick={() => goToPage(page + 1)}>
              →
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
