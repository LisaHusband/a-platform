import { FormEvent, useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, PaymentOrder, Purchase, Subscription, Topic, User } from "../api";
import ContentCardView from "../components/ContentCardView";
import PaymentModal from "../components/PaymentModal";
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
    <div className="auth-card">
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
  const [orders, setOrders] = useState<PaymentOrder[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [topicSlug, setTopicSlug] = useState("");
  const [payRef, setPayRef] = useState<string | null>(null);

  const load = useCallback(() => {
    api<Purchase[]>("/billing/purchases").then(setPurchases).catch(() => {});
    api<Subscription[]>("/billing/subscriptions").then(setSubs).catch(() => {});
    api<PaymentOrder[]>("/payments").then(setOrders).catch(() => {});
    api<Topic[]>("/taxonomy/topics").then(setTopics).catch(() => {});
  }, []);
  useEffect(load, [load]);

  const payAmount = payRef === "monthly" ? 30 : 12;

  return (
    <div>
      <div className="profile-head">
        <div className="avatar">{user!.name.slice(0, 1)}</div>
        <div>
          <h1 style={{ margin: 0 }}>{user!.name}</h1>
          <span className={`chip role-${user!.role}`}>{t(`roles.${user!.role}`)}</span>
        </div>
      </div>

      <div className="wallet-card">
        <div>
          <div className="meta">{t("wallet.balance")}</div>
          <div className="wallet-amount">¥{user!.balance.toFixed(2)}</div>
          <div className="meta">{t("wallet.free")}</div>
        </div>
        <span className="wallet-emoji">💰</span>
      </div>

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
        <button className="primary" onClick={() => setPayRef("monthly")}>
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
        <button disabled={!topicSlug} onClick={() => setPayRef(`topic:${topicSlug}`)}>
          {t("account.subscribeTopic")}
        </button>
      </div>

      <h2>{t("account.purchases")}</h2>
      {purchases.length === 0 && <p className="meta">{t("account.none")}</p>}
      {purchases.map((p) => (
        <ContentCardView key={p.id} content={p.content} />
      ))}

      <h2>{t("wallet.orders")}</h2>
      {orders.length === 0 && <p className="meta">{t("wallet.none")}</p>}
      {orders.length > 0 && (
        <table className="orders">
          <thead>
            <tr>
              <th>{t("wallet.amount")}</th>
              <th>{t("wallet.method")}</th>
              <th>{t("wallet.status")}</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id}>
                <td>¥{o.amount}</td>
                <td>{t(`pay.${o.method}`)}</td>
                <td>
                  <span className={`badge status-${o.status}`}>{o.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {payRef && (
        <PaymentModal
          kind="subscription"
          refId={payRef}
          title={payRef === "monthly" ? t("account.subscribeMonthly") : t("account.subscribeTopic")}
          amount={payAmount}
          onClose={() => setPayRef(null)}
          onSuccess={() => {
            setPayRef(null);
            load();
          }}
        />
      )}
    </div>
  );
}
