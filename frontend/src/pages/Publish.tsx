import { FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { api, API_BASE, Category, ContentDetail, getToken } from "../api";
import { useApp, useLocalName } from "../context";

type Tab = "paste" | "url" | "file";

export default function Publish() {
  const { t } = useTranslation();
  const { user } = useApp();
  const name = useLocalName();
  const [tab, setTab] = useState<Tab>("paste");
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState<number>(0);
  const [lang, setLang] = useState("zh");
  const [contentType, setContentType] = useState("article");
  // paste
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [authorName, setAuthorName] = useState("");
  // url
  const [url, setUrl] = useState("");
  // file
  const [file, setFile] = useState<File | null>(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<ContentDetail | null>(null);

  useEffect(() => {
    api<Category[]>("/taxonomy/categories")
      .then((c) => {
        setCategories(c);
        if (c.length) setCategoryId(c[0].id);
      })
      .catch(() => {});
  }, []);

  if (!user) {
    return (
      <div className="page container">
        <p>
          {t("publish.needLogin")} <Link to="/account">{t("account.login")}</Link>
        </p>
      </div>
    );
  }

  async function submitPasteOrUrl(e: FormEvent) {
    e.preventDefault();
    setError("");
    setCreated(null);
    setBusy(true);
    try {
      const payload =
        tab === "url"
          ? { source_type: "url", url, category_id: categoryId }
          : {
              source_type: "paste",
              title,
              body,
              author_name: authorName,
              lang,
              content_type: contentType,
              category_id: categoryId,
            };
      const res = await api<ContentDetail>("/submissions", { method: "POST", body: payload });
      setCreated(res);
    } catch (err) {
      setError(String((err as Error).message));
    } finally {
      setBusy(false);
    }
  }

  async function submitFile(e: FormEvent) {
    e.preventDefault();
    if (!file) return;
    setError("");
    setCreated(null);
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("title", title || file.name);
      fd.append("content_type", contentType);
      fd.append("lang", lang);
      if (categoryId) fd.append("category_id", String(categoryId));
      // FormData uploads bypass the JSON api() helper
      const res = await fetch(`${API_BASE}/submissions/file`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken()}` },
        body: fd,
      });
      if (!res.ok) throw new Error((await res.json()).detail ?? res.statusText);
      setCreated((await res.json()) as ContentDetail);
    } catch (err) {
      setError(String((err as Error).message));
    } finally {
      setBusy(false);
    }
  }

  const MetaSelects = (
    <>
      <label>
        {t("publish.fields.category")}
        <select value={categoryId} onChange={(e) => setCategoryId(Number(e.target.value))}>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {name(c)}
            </option>
          ))}
        </select>
      </label>
      <label>
        {t("publish.fields.type")}
        <select value={contentType} onChange={(e) => setContentType(e.target.value)}>
          {["article", "report", "series", "video", "audio"].map((ty) => (
            <option key={ty} value={ty}>
              {t(`browse.types.${ty}`)}
            </option>
          ))}
        </select>
      </label>
      <label>
        {t("publish.fields.lang")}
        <select value={lang} onChange={(e) => setLang(e.target.value)}>
          <option value="zh">中文</option>
          <option value="en">English</option>
        </select>
      </label>
    </>
  );

  return (
    <div className="page container">
      <h1>{t("publish.title")}</h1>
      <p className="meta">{t("publish.subtitle")}</p>

      <div className="tabs">
        {(["paste", "url", "file"] as Tab[]).map((x) => (
          <button
            key={x}
            className={`tab ${tab === x ? "active" : ""}`}
            onClick={() => {
              setTab(x);
              setCreated(null);
              setError("");
            }}
          >
            {t(`submit.tabs.${x}`)}
          </button>
        ))}
      </div>

      {created ? (
        <div className="card ok-card">
          <p className="ok-msg">✅ {t("submit.done")}</p>
          <Link className="primary-link" to={`/content/${created.id}`}>
            {t("submit.view")} →
          </Link>
        </div>
      ) : tab === "file" ? (
        <form className="form" onSubmit={submitFile}>
          <label>
            {t("publish.fields.title")}
            <input value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label>
            {t("submit.file")}
            <input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </label>
          {MetaSelects}
          {error && <p className="error-msg">{error}</p>}
          <button className="primary" type="submit" disabled={busy || !file}>
            {busy ? t("submit.submitting") : t("submit.fileSubmit")}
          </button>
        </form>
      ) : (
        <form className="form" onSubmit={submitPasteOrUrl}>
          {tab === "url" ? (
            <>
              <label>
                {t("submit.url")}
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  required
                  placeholder="https://example.com/article"
                />
              </label>
              <p className="meta">{t("submit.urlHint")}</p>
            </>
          ) : (
            <>
              <label>
                {t("publish.fields.title")}
                <input value={title} onChange={(e) => setTitle(e.target.value)} required minLength={4} />
              </label>
              <label>
                {t("publish.fields.body")}
                <textarea value={body} onChange={(e) => setBody(e.target.value)} required />
              </label>
              <label>
                {t("submit.author")}
                <input value={authorName} onChange={(e) => setAuthorName(e.target.value)} />
              </label>
            </>
          )}
          {MetaSelects}
          {error && <p className="error-msg">{error}</p>}
          <button className="primary" type="submit" disabled={busy}>
            {busy ? t("submit.submitting") : tab === "url" ? t("submit.urlSubmit") : t("submit.pasteSubmit")}
          </button>
        </form>
      )}
    </div>
  );
}
