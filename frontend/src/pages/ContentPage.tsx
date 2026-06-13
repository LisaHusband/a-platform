import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, ContentCard, ContentDetail } from "../api";
import ContentCardView from "../components/ContentCardView";
import Markdown from "../components/Markdown";
import { useApp, useLocalName } from "../context";

export default function ContentPage() {
  const { id } = useParams();
  const { t, i18n } = useTranslation();
  const { user } = useApp();
  const name = useLocalName();
  const navigate = useNavigate();
  const [content, setContent] = useState<ContentDetail | null>(null);
  const [related, setRelated] = useState<ContentCard[]>([]);
  const [error, setError] = useState("");
  const [reading, setReading] = useState(false);
  const [fontSize, setFontSize] = useState(19);

  const load = useCallback(() => {
    api<ContentDetail>(`/contents/${id}`)
      .then(setContent)
      .catch((e) => setError(String(e.message)));
    api<ContentCard[]>(`/contents/${id}/related`)
      .then(setRelated)
      .catch(() => setRelated([]));
  }, [id]);

  useEffect(load, [load]);

  useEffect(() => {
    document.body.classList.toggle("reading-mode", reading);
    document.body.style.setProperty("--read-size", `${fontSize}px`);
    return () => document.body.classList.remove("reading-mode");
  }, [reading, fontSize]);

  async function buy() {
    if (!user) {
      navigate("/account");
      return;
    }
    try {
      await api(`/billing/purchase/${id}`, { method: "POST" });
      load();
    } catch (e) {
      setError(String((e as Error).message));
    }
  }

  if (error && !content) {
    return (
      <div className="page container">
        <p className="error-msg">{t("common.error")}{error}</p>
      </div>
    );
  }
  if (!content) {
    return <div className="page container">{t("common.loading")}</div>;
  }

  const date = content.published_at
    ? new Date(content.published_at).toLocaleDateString(
        i18n.language.startsWith("zh") ? "zh-CN" : "en-US",
      )
    : "";

  return (
    <div className="page container">
      <article className="article">
        <h1 className="title">{content.title}</h1>
        {content.subtitle && <p className="subtitle">{content.subtitle}</p>}
        <div className="meta article-meta-extra">
          <span className="chip type">{t(`browse.types.${content.content_type}`)}</span>
          {content.category && <span className="chip">{name(content.category)}</span>}
          {content.author && <span>{t("content.by")} {content.author.name}</span>}
          <span>{date}</span>
          <span>{t("content.minutes", { n: content.reading_minutes })}</span>
          {content.has_access ? (
            <span className="ok-msg">{t("content.purchased")}</span>
          ) : (
            <span className="price-tag">${content.price}</span>
          )}
        </div>
        <div className="toolbar article-meta-extra" style={{ marginTop: 12 }}>
          <button onClick={() => setReading(true)}>{t("content.readingMode")}</button>
        </div>

        {error && <p className="error-msg">{t("common.error")}{error}</p>}

        {content.has_access && content.body ? (
          <>
            <Markdown source={content.body} />
            {content.sources && (
              <section className="article-meta-extra">
                <h3>{t("content.sources")}</h3>
                <pre className="explain">{content.sources}</pre>
              </section>
            )}
          </>
        ) : (
          <>
            <h3 className="article-meta-extra">{t("content.preview")}</h3>
            <Markdown source={content.preview} />
            <div className="paywall">
              <div className="paywall-box">
                <p>{t("content.lockedNotice")}</p>
                <button className="primary" onClick={buy}>
                  {t("content.buy", { price: content.price })}
                </button>
                <p className="meta" style={{ justifyContent: "center", marginTop: 10 }}>
                  <Link to="/account">{t("content.subscribeHint")}</Link>
                </p>
              </div>
            </div>
          </>
        )}
      </article>

      {reading && (
        <div className="reading-bar">
          <span>{t("content.fontSize")}</span>
          <button onClick={() => setFontSize((s) => Math.max(15, s - 2))}>A−</button>
          <button onClick={() => setFontSize((s) => Math.min(27, s + 2))}>A+</button>
          <button className="primary" onClick={() => setReading(false)}>
            {t("content.exitReading")}
          </button>
        </div>
      )}

      {related.length > 0 && (
        <section className="related-block" style={{ marginTop: 40 }}>
          <h2>{t("content.related")}</h2>
          {related.map((c) => (
            <ContentCardView key={c.id} content={c} />
          ))}
        </section>
      )}
    </div>
  );
}
