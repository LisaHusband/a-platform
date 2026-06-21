import { FormEvent, useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router-dom";
import { api, Page, ThreadCard, ThreadDetail } from "../api";
import { useApp } from "../context";

const PAGE_SIZE = 15;

export default function Board() {
  const { slug = "" } = useParams();
  const { t } = useTranslation();
  const { user } = useApp();
  const [data, setData] = useState<Page<ThreadCard> | null>(null);
  const [sort, setSort] = useState("latest");
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [kw, setKw] = useState("");
  const [error, setError] = useState("");
  const [composing, setComposing] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  const load = useCallback(() => {
    const qs = new URLSearchParams({
      sort,
      page: String(page),
      page_size: String(PAGE_SIZE),
    });
    if (q) qs.set("q", q);
    api<Page<ThreadCard>>(`/community/boards/${slug}/threads?${qs}`)
      .then(setData)
      .catch((e) => setError(String(e.message)));
  }, [slug, sort, page, q]);
  useEffect(load, [load]);

  async function createThread(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await api<ThreadDetail>(`/community/boards/${slug}/threads`, {
        method: "POST",
        body: { title, body },
      });
      setTitle("");
      setBody("");
      setComposing(false);
      setPage(1);
      load();
    } catch (err) {
      setError(String((err as Error).message));
    }
  }

  const items = data?.items ?? [];
  const pages = data ? Math.max(1, Math.ceil(data.total / data.page_size)) : 1;

  return (
    <div className="page container">
      <div className="board-head">
        <h1>/{slug}</h1>
        {user ? (
          <button className="primary" onClick={() => setComposing((c) => !c)}>
            ✏️ {t("community.newThread")}
          </button>
        ) : (
          <Link to="/account" className="meta">{t("community.needLogin")}</Link>
        )}
      </div>

      {composing && (
        <form className="card compose" onSubmit={createThread}>
          <input
            placeholder={t("community.threadTitle")}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            minLength={2}
          />
          <textarea
            placeholder={t("community.threadBody")}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            required
          />
          <div className="modal-actions">
            <button type="button" onClick={() => setComposing(false)}>
              {t("pay.cancel")}
            </button>
            <button className="primary" type="submit">{t("community.post")}</button>
          </div>
        </form>
      )}

      <div className="toolbar">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
            setQ(kw.trim());
          }}
          style={{ display: "flex", gap: 8, flex: 1 }}
        >
          <input
            className="grow"
            placeholder={t("community.searchPlaceholder")}
            value={kw}
            onChange={(e) => setKw(e.target.value)}
          />
        </form>
        <select value={sort} onChange={(e) => { setPage(1); setSort(e.target.value); }}>
          {(["latest", "hot", "new"] as const).map((s) => (
            <option key={s} value={s}>{t(`community.sort.${s}`)}</option>
          ))}
        </select>
      </div>

      {error && <p className="error-msg">{t("common.error")}{error}</p>}
      {items.length === 0 && !error && <p>{t("community.empty")}</p>}

      <ul className="thread-list">
        {items.map((th) => (
          <li key={th.id} className="thread-row">
            <div className="thread-main">
              <div className="thread-badges">
                {th.is_pinned ? <span className="badge pin">{t("community.pinned")}</span> : null}
                {th.is_featured ? <span className="badge feat">{t("community.featured")}</span> : null}
                {th.is_locked ? <span className="badge lock">{t("community.locked")}</span> : null}
              </div>
              <Link to={`/thread/${th.id}`} className="thread-title">{th.title}</Link>
              <div className="meta">
                {th.author?.name} · {t("community.replies", { n: th.reply_count })} ·{" "}
                {t("community.views", { n: th.views })} · {t("community.likes", { n: th.like_count })}
              </div>
            </div>
            <div className="thread-stat">{th.reply_count}</div>
          </li>
        ))}
      </ul>

      {data && pages > 1 && (
        <div className="pagination">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>←</button>
          <span>{page} / {pages}</span>
          <button disabled={!data.has_more} onClick={() => setPage((p) => p + 1)}>→</button>
        </div>
      )}
    </div>
  );
}
