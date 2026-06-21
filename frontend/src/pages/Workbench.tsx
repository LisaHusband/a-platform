import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { api, ContentCard } from "../api";
import { roleCan, useApp } from "../context";

const TOOLS: { cap: string; key: string; to?: string }[] = [
  { cap: "submit", key: "submit", to: "/publish" },
  { cap: "reviewTier2", key: "reviewTier2" },
  { cap: "reviewTier3", key: "reviewTier3" },
  { cap: "publish", key: "publish" },
  { cap: "moderate", key: "moderate", to: "/community" },
  { cap: "boards", key: "boards", to: "/community" },
];

export default function Workbench() {
  const { t } = useTranslation();
  const { user } = useApp();

  if (!user) {
    return (
      <div className="page container">
        <p>{t("publish.needLogin")} <Link to="/account">{t("account.login")}</Link></p>
      </div>
    );
  }

  const tools = TOOLS.filter((x) => roleCan(user.role, x.cap));
  const tier = roleCan(user.role, "reviewTier2") ? 2 : roleCan(user.role, "reviewTier3") ? 3 : 0;

  return (
    <div className="page container">
      <header className="section-hero">
        <h1>{t("workbench.title")}</h1>
        <p className="meta">
          {t("workbench.subtitle")} · <span className={`chip role-${user.role}`}>{t(`roles.${user.role}`)}</span>
        </p>
      </header>

      {tools.length === 0 ? (
        <p className="meta">{t("workbench.none")}</p>
      ) : (
        <div className="tool-grid">
          {tools.map((x) => {
            const card = (
              <div className="tool-card">
                <h3>{t(`workbench.${x.key}`)}</h3>
                <p className="meta">{t(`workbench.${x.key}Desc`)}</p>
              </div>
            );
            return x.to ? (
              <Link key={x.key} to={x.to}>{card}</Link>
            ) : (
              <div key={x.key}>{card}</div>
            );
          })}
        </div>
      )}

      {(tier === 2 || tier === 3) && <ReviewQueue tier={tier} />}
    </div>
  );
}

function ReviewQueue({ tier }: { tier: 2 | 3 }) {
  const { t } = useTranslation();
  const [items, setItems] = useState<ContentCard[]>([]);
  const [msg, setMsg] = useState("");

  const load = useCallback(() => {
    api<ContentCard[]>("/review/queue")
      .then(setItems)
      .catch((e) => setMsg(String(e.message)));
  }, []);
  useEffect(load, [load]);

  async function act(path: string, body?: unknown) {
    setMsg("");
    try {
      await api(path, { method: "POST", body });
      load();
    } catch (e) {
      setMsg(String((e as Error).message));
    }
  }

  return (
    <section style={{ marginTop: 32 }}>
      <h2>{tier === 2 ? t("workbench.reviewTier2") : t("workbench.reviewTier3")}</h2>
      {msg && <p className="error-msg">{msg}</p>}
      {items.length === 0 && <p className="meta">{t("workbench.queueEmpty")}</p>}
      {items.map((c) => (
        <div className="card review-row" key={c.id}>
          <div>
            <Link to={`/content/${c.id}`} className="thread-title">{c.title}</Link>
            <div className="meta">
              <span className="chip type">{t(`browse.types.${c.content_type}`)}</span> {c.status}
            </div>
          </div>
          <div className="review-actions">
            <button
              className="primary"
              onClick={() => act(`/review/${c.id}/tier${tier}`, { verdict: "pass" })}
            >
              {t("workbench.pass")}
            </button>
            <button onClick={() => act(`/review/${c.id}/tier${tier}`, { verdict: "reject" })}>
              {t("workbench.reject")}
            </button>
            {tier === 2 && (
              <button onClick={() => act(`/contents/${c.id}/publish`)}>
                {t("workbench.publishAction")}
              </button>
            )}
          </div>
        </div>
      ))}
    </section>
  );
}
