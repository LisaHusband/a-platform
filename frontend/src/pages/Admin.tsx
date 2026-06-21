import { FormEvent, useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import {
  api,
  ContentCard,
  CrawlSite,
  CrawlTask,
  Page,
  RobotsCheck,
  Takedown,
} from "../api";
import { roleCan, useApp } from "../context";

type Tab = "moderation" | "crawl" | "sites" | "takedowns";

export default function Admin() {
  const { t } = useTranslation();
  const { user } = useApp();
  const [tab, setTab] = useState<Tab>("moderation");

  if (!roleCan(user?.role, "moderate")) {
    return (
      <div className="page container">
        <p>{t("publish.needLogin")} <Link to="/account">{t("account.login")}</Link></p>
      </div>
    );
  }

  return (
    <div className="page container">
      <header className="section-hero">
        <h1>{t("admin.title")}</h1>
      </header>
      <div className="tabs">
        {(["moderation", "crawl", "sites", "takedowns"] as Tab[]).map((x) => (
          <button key={x} className={`tab ${tab === x ? "active" : ""}`} onClick={() => setTab(x)}>
            {t(`admin.tabs.${x}`)}
          </button>
        ))}
      </div>
      {tab === "moderation" && <Moderation />}
      {tab === "crawl" && <Crawl />}
      {tab === "sites" && <Sites />}
      {tab === "takedowns" && <Takedowns />}
    </div>
  );
}

function Moderation() {
  const { t } = useTranslation();
  const [status, setStatus] = useState("pending");
  const [data, setData] = useState<Page<ContentCard> | null>(null);
  const [msg, setMsg] = useState("");

  const load = useCallback(() => {
    api<Page<ContentCard>>(`/admin/contents?status=${status}&page_size=50`)
      .then(setData)
      .catch((e) => setMsg(String(e.message)));
  }, [status]);
  useEffect(load, [load]);

  async function act(id: number, action: string, extra: object = {}) {
    setMsg("");
    try {
      await api(`/admin/contents/${id}/moderate`, { method: "POST", body: { action, ...extra } });
      load();
    } catch (e) {
      setMsg(String((e as Error).message));
    }
  }

  return (
    <section>
      <div className="toolbar">
        <label>
          {t("admin.status")}{" "}
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            {["pending", "published", "rejected", "needs_fix", "archived"].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>
      </div>
      {msg && <p className="error-msg">{msg}</p>}
      {data?.items.length === 0 && <p className="meta">{t("admin.empty")}</p>}
      {data?.items.map((c) => (
        <div className="card review-row" key={c.id}>
          <div>
            <Link to={`/content/${c.id}`} className="thread-title">{c.title}</Link>
            <div className="meta">
              <span className={`chip type`}>{c.source_type}</span> {c.status}
              {c.source_domain && <> · {c.source_domain}</>}
            </div>
          </div>
          <div className="review-actions">
            <button className="primary" onClick={() => act(c.id, "approve")}>{t("admin.approve")}</button>
            <button onClick={() => act(c.id, "needs_fix")}>{t("admin.needsFix")}</button>
            <button onClick={() => act(c.id, "reject")}>{t("admin.reject")}</button>
            <button onClick={() => act(c.id, "archive")}>{t("admin.archive")}</button>
          </div>
        </div>
      ))}
    </section>
  );
}

function Crawl() {
  const { t } = useTranslation();
  const [tasks, setTasks] = useState<CrawlTask[]>([]);
  const [url, setUrl] = useState("");
  const [robots, setRobots] = useState<RobotsCheck | null>(null);
  const [msg, setMsg] = useState("");

  const load = useCallback(() => {
    api<CrawlTask[]>("/crawl/tasks").then(setTasks).catch(() => {});
  }, []);
  useEffect(load, [load]);

  async function enqueue(e: FormEvent) {
    e.preventDefault();
    setMsg("");
    try {
      await api("/crawl/tasks", { method: "POST", body: { url } });
      setUrl("");
      load();
    } catch (e) {
      setMsg(String((e as Error).message));
    }
  }
  async function check() {
    setMsg("");
    try {
      setRobots(await api<RobotsCheck>(`/crawl/check-robots?url=${encodeURIComponent(url)}`));
    } catch (e) {
      setMsg(String((e as Error).message));
    }
  }

  return (
    <section>
      <form className="toolbar" onSubmit={enqueue}>
        <input
          className="grow"
          placeholder={t("admin.enqueueUrl")}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <button type="button" onClick={check} disabled={!url}>{t("admin.checkRobots")}</button>
        <button className="primary" type="submit" disabled={!url}>{t("admin.enqueue")}</button>
      </form>
      {robots && (
        <p className="meta">
          {t("admin.robotsResult")}: <strong>{robots.decision}</strong>
          {robots.crawl_delay != null && <> · delay {robots.crawl_delay}s</>}
        </p>
      )}
      {msg && <p className="error-msg">{msg}</p>}
      <table className="orders">
        <thead>
          <tr>
            <th>URL</th><th>{t("admin.taskStatus")}</th><th>{t("admin.robotsDecision")}</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((tk) => (
            <tr key={tk.id}>
              <td>
                {tk.content_id ? (
                  <Link to={`/content/${tk.content_id}`}>{tk.url}</Link>
                ) : (
                  tk.url
                )}
              </td>
              <td><span className={`badge status-${tk.status}`}>{tk.status}</span></td>
              <td>{tk.robots_decision}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function Sites() {
  const { t } = useTranslation();
  const [sites, setSites] = useState<CrawlSite[]>([]);
  const [domain, setDomain] = useState("");
  const [delay, setDelay] = useState(1);
  const [msg, setMsg] = useState("");

  const load = useCallback(() => {
    api<CrawlSite[]>("/crawl/sites").then(setSites).catch(() => {});
  }, []);
  useEffect(load, [load]);

  async function addSite(e: FormEvent) {
    e.preventDefault();
    setMsg("");
    try {
      await api("/crawl/sites", { method: "POST", body: { domain, crawl_delay: delay } });
      setDomain("");
      load();
    } catch (e) {
      setMsg(String((e as Error).message));
    }
  }
  async function toggleBlacklist(s: CrawlSite) {
    await api(`/crawl/sites/${s.id}`, {
      method: "PATCH",
      body: { ...s, is_blacklisted: s.is_blacklisted ? 0 : 1 },
    }).catch(() => {});
    load();
  }

  return (
    <section>
      <form className="toolbar" onSubmit={addSite}>
        <input
          className="grow"
          placeholder={t("admin.domain")}
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          required
        />
        <input
          type="number"
          min={0}
          step={0.5}
          value={delay}
          onChange={(e) => setDelay(Number(e.target.value))}
          aria-label={t("admin.crawlDelay")}
        />
        <button className="primary" type="submit">{t("admin.addSite")}</button>
      </form>
      {msg && <p className="error-msg">{msg}</p>}
      <table className="orders">
        <thead>
          <tr>
            <th>{t("admin.domain")}</th><th>{t("admin.crawlDelay")}</th><th>{t("admin.blacklist")}</th>
          </tr>
        </thead>
        <tbody>
          {sites.map((s) => (
            <tr key={s.id}>
              <td>{s.domain}</td>
              <td>{s.crawl_delay}</td>
              <td>
                <button className={s.is_blacklisted ? "danger-btn" : ""} onClick={() => toggleBlacklist(s)}>
                  {s.is_blacklisted ? "✓" : "—"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function Takedowns() {
  const { t } = useTranslation();
  const [items, setItems] = useState<Takedown[]>([]);
  const [msg, setMsg] = useState("");

  const load = useCallback(() => {
    api<Takedown[]>("/admin/takedowns").then(setItems).catch(() => {});
  }, []);
  useEffect(load, [load]);

  async function resolve(id: number, status: string) {
    setMsg("");
    try {
      await api(`/admin/takedowns/${id}/resolve`, { method: "POST", body: { status, resolution: "" } });
      load();
    } catch (e) {
      setMsg(String((e as Error).message));
    }
  }

  return (
    <section>
      {msg && <p className="error-msg">{msg}</p>}
      {items.length === 0 && <p className="meta">{t("admin.empty")}</p>}
      {items.map((tk) => (
        <div className="card review-row" key={tk.id}>
          <div>
            <Link to={`/content/${tk.content_id}`} className="thread-title">#{tk.content_id}</Link>
            <div className="meta">{tk.reason} · <span className={`badge status-${tk.status}`}>{tk.status}</span></div>
          </div>
          {tk.status === "open" && (
            <div className="review-actions">
              <button className="primary" onClick={() => resolve(tk.id, "resolved")}>{t("admin.resolve")}</button>
              <button onClick={() => resolve(tk.id, "rejected")}>{t("admin.rejectTakedown")}</button>
            </div>
          )}
        </div>
      ))}
    </section>
  );
}
