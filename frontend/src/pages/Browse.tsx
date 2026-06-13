import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { api, Category, ContentCard, Named, Topic } from "../api";
import ContentCardView from "../components/ContentCardView";
import { useLocalName } from "../context";

const TYPES = ["article", "report", "series", "video", "audio"];

export default function Browse() {
  const { t } = useTranslation();
  const name = useLocalName();
  const [params, setParams] = useSearchParams();
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<Named[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [contents, setContents] = useState<ContentCard[]>([]);
  const [error, setError] = useState("");

  const category = params.get("category") ?? "";
  const tag = params.get("tag") ?? "";
  const topic = params.get("topic") ?? "";
  const type = params.get("type") ?? "";
  const lang = params.get("lang") ?? "";

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
    api<ContentCard[]>(`/contents?${qs}`)
      .then(setContents)
      .catch((e) => setError(String(e.message)));
  }, [category, tag, topic, type, lang]);

  function setFilter(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next);
  }

  const roots = categories.filter((c) => c.parent_id === null);

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
        <div className="toolbar">
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
        </div>
        {error && <p className="error-msg">{t("common.error")}{error}</p>}
        {contents.length === 0 && !error && <p>{t("browse.empty")}</p>}
        {contents.map((c) => (
          <ContentCardView key={c.id} content={c} />
        ))}
      </main>
    </div>
  );
}
