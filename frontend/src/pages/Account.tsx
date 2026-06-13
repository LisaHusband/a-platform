import { FormEvent, useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, Purchase, Subscription, Topic, User } from "../api";
import ContentCardView from "../components/ContentCardView";
import { useApp, useLocalName } from "../context";

export default function Account() {
  const { t } = useTranslation();
  const { user, login, logout } = useApp();
  return (
    <div className="page container">
      {user ? <Dashboard /> : <AuthForms onAuth={login} />}
      {user && (
        <button style={{ marginTop: 24 }} onClick={logout}>
          {t("account.logout")}
        </button>
      )}
    </div>
  );
}

function AuthForms({ onAuth }: { onAuth: (token: string, user: User) => void }) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      const body = mode === "login" ? { email, password } : { email, name, password };
      const res = await api<{ token: string; user: User }>(`/auth/${mode}`, {
        method: "POST",
        body,
      });
      onAuth(res.token, res.user);
    } catch (err) {
      setError(String((err as Error).message));
    }
  }

  return (
    <div>
      <div className="toolbar">
        <button className={mode === "login" ? "primary" : ""} onClick={() => setMode("login")}>
          {t("account.login")}
        </button>
        <button
          className={mode === "register" ? "primary" : ""}
          onClick={() => setMode("register")}
        >
          {t("account.register")}
        </button>
      </div>
      <form className="form" onSubmit={submit}>
        <label>
          {t("account.email")}
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        {mode === "register" && (
          <label>
            {t("account.name")}
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
        )}
        <label>
          {t("account.password")}
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
          />
        </label>
        {error && <p className="error-msg">{error}</p>}
        <button className="primary" type="submit">
          {mode === "login" ? t("account.login") : t("account.register")}
        </button>
      </form>
      <p className="meta" style={{ marginTop: 16 }}>{t("account.demo")}</p>
    </div>
  );
}

function Dashboard() {
  const { t } = useTranslation();
  const { user } = useApp();
  const name = useLocalName();
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [topicSlug, setTopicSlug] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(() => {
    api<Purchase[]>("/billing/purchases").then(setPurchases).catch(() => {});
    api<Subscription[]>("/billing/subscriptions").then(setSubs).catch(() => {});
    api<Topic[]>("/taxonomy/topics").then(setTopics).catch(() => {});
  }, []);
  useEffect(load, [load]);

  async function subscribe(plan: "monthly" | "topic") {
    setError("");
    try {
      await api("/billing/subscribe", {
        method: "POST",
        body: { plan, topic_slug: plan === "topic" ? topicSlug : null },
      });
      load();
    } catch (e) {
      setError(String((e as Error).message));
    }
  }

  return (
    <div>
      <h1>
        {user!.name} <span className="chip type">{user!.role}</span>
      </h1>

      <h2>{t("account.subscriptions")}</h2>
      {subs.length === 0 && <p className="meta">{t("account.none")}</p>}
      {subs.map((s) => (
        <div className="card" key={s.id}>
          <strong>{s.plan === "monthly" ? "Site-wide" : name(s.topic)}</strong>{" "}
          <span className="meta">
            {t("account.expires")}: {new Date(s.expires_at).toLocaleDateString()}
          </span>
        </div>
      ))}
      <div className="toolbar">
        <button className="primary" onClick={() => subscribe("monthly")}>
          {t("account.subscribeMonthly")}
        </button>
        <select value={topicSlug} onChange={(e) => setTopicSlug(e.target.value)}>
          <option value="">—</option>
          {topics.map((tp) => (
            <option key={tp.id} value={tp.slug}>
              {name(tp)}
            </option>
          ))}
        </select>
        <button disabled={!topicSlug} onClick={() => subscribe("topic")}>
          {t("account.subscribeTopic")}
        </button>
      </div>
      {error && <p className="error-msg">{error}</p>}

      <h2>{t("account.purchases")}</h2>
      {purchases.length === 0 && <p className="meta">{t("account.none")}</p>}
      {purchases.map((p) => (
        <ContentCardView key={p.id} content={p.content} />
      ))}
    </div>
  );
}
