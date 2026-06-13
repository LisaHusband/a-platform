import { FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { api, Category, ContentDetail } from "../api";
import { useApp, useLocalName } from "../context";

interface Tier1Result {
  passed: boolean;
  score: number;
  status: string;
  rules: { rule: string; passed: boolean; message: string; penalty: number }[];
}

export default function Publish() {
  const { t } = useTranslation();
  const { user } = useApp();
  const name = useLocalName();
  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState({
    title: "",
    subtitle: "",
    abstract: "",
    body: "",
    sources: "",
    price: 6,
    category_id: 0,
    lang: "zh",
    content_type: "article",
  });
  const [result, setResult] = useState<Tier1Result | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<Category[]>("/taxonomy/categories")
      .then((c) => {
        setCategories(c);
        if (c.length) setForm((f) => ({ ...f, category_id: c[0].id }));
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

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setResult(null);
    setBusy(true);
    try {
      const created = await api<ContentDetail>("/contents", {
        method: "POST",
        body: { ...form, tag_slugs: [], topic_slugs: [] },
      });
      const tier1 = await api<Tier1Result>(`/review/${created.id}/tier1`, {
        method: "POST",
      });
      setResult(tier1);
    } catch (err) {
      setError(String((err as Error).message));
    } finally {
      setBusy(false);
    }
  }

  const set = (key: string) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [key]: key === "price" ? Number(e.target.value) : e.target.value }));

  return (
    <div className="page container">
      <h1>{t("publish.title")}</h1>
      <p className="meta">{t("publish.subtitle")}</p>
      <form className="form" onSubmit={submit}>
        <label>
          {t("publish.fields.title")}
          <input value={form.title} onChange={set("title")} required minLength={4} />
        </label>
        <label>
          {t("publish.fields.subtitle")}
          <input value={form.subtitle} onChange={set("subtitle")} />
        </label>
        <label>
          {t("publish.fields.abstract")}
          <textarea
            style={{ minHeight: 70 }}
            value={form.abstract}
            onChange={set("abstract")}
          />
        </label>
        <label>
          {t("publish.fields.body")}
          <textarea value={form.body} onChange={set("body")} required />
        </label>
        <label>
          {t("publish.fields.sources")}
          <textarea style={{ minHeight: 70 }} value={form.sources} onChange={set("sources")} />
        </label>
        <label>
          {t("publish.fields.category")}
          <select value={form.category_id} onChange={set("category_id")}>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {name(c)}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t("publish.fields.lang")}
          <select value={form.lang} onChange={set("lang")}>
            <option value="zh">中文</option>
            <option value="en">English</option>
          </select>
        </label>
        <label>
          {t("publish.fields.type")}
          <select value={form.content_type} onChange={set("content_type")}>
            {["article", "report", "series", "video", "audio"].map((ty) => (
              <option key={ty} value={ty}>
                {t(`browse.types.${ty}`)}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t("publish.fields.price")}
          <input type="number" min={0} step={0.5} value={form.price} onChange={set("price")} />
        </label>
        {error && <p className="error-msg">{error}</p>}
        <button className="primary" type="submit" disabled={busy}>
          {t("publish.submit")}
        </button>
      </form>

      {result && (
        <div className="card" style={{ marginTop: 24 }}>
          <h3>
            {t("publish.tier1Result")}:{" "}
            <span className={result.passed ? "ok-msg" : "error-msg"}>
              {result.passed ? t("publish.passed") : t("publish.failed")} ({result.score}/100)
            </span>
          </h3>
          {result.rules.map((r) => (
            <div key={r.rule} className={`rule-line ${r.passed ? "pass" : "fail"}`}>
              [{r.passed ? "PASS" : "FAIL"}] {r.rule}: {r.message}
              {r.penalty > 0 ? ` (-${r.penalty})` : ""}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
