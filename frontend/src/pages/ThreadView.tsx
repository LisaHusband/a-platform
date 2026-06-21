import { FormEvent, useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router-dom";
import { api, CommunityPost, Page, ThreadDetail } from "../api";
import Markdown from "../components/Markdown";
import { roleCan, useApp } from "../context";

const MOD_ACTIONS = ["pin", "unpin", "lock", "unlock", "feature", "unfeature"] as const;

export default function ThreadView() {
  const { id = "" } = useParams();
  const { t, i18n } = useTranslation();
  const { user } = useApp();
  const [thread, setThread] = useState<ThreadDetail | null>(null);
  const [posts, setPosts] = useState<Page<CommunityPost> | null>(null);
  const [page, setPage] = useState(1);
  const [reply, setReply] = useState("");
  const [error, setError] = useState("");

  const loadThread = useCallback(() => {
    api<ThreadDetail>(`/community/threads/${id}`)
      .then(setThread)
      .catch((e) => setError(String(e.message)));
  }, [id]);
  const loadPosts = useCallback(() => {
    api<Page<CommunityPost>>(`/community/threads/${id}/posts?page=${page}&page_size=20`)
      .then(setPosts)
      .catch(() => {});
  }, [id, page]);

  useEffect(loadThread, [loadThread]);
  useEffect(loadPosts, [loadPosts]);

  async function submitReply(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await api(`/community/threads/${id}/posts`, { method: "POST", body: { body: reply } });
      setReply("");
      loadThread();
      loadPosts();
    } catch (err) {
      setError(String((err as Error).message));
    }
  }

  async function likeThread() {
    await api(`/community/threads/${id}/like`, { method: "POST" }).catch(() => {});
    loadThread();
  }
  async function likePost(pid: number) {
    await api(`/community/posts/${pid}/like`, { method: "POST" }).catch(() => {});
    loadPosts();
  }
  async function moderate(action: string) {
    await api(`/community/threads/${id}/moderate`, {
      method: "POST",
      body: { action },
    }).catch(() => {});
    loadThread();
  }

  if (error && !thread) {
    return <div className="page container"><p className="error-msg">{t("common.error")}{error}</p></div>;
  }
  if (!thread) return <div className="page container">{t("common.loading")}</div>;

  const date = (s: string) =>
    new Date(s).toLocaleString(i18n.language.startsWith("zh") ? "zh-CN" : "en-US");
  const canModerate = roleCan(user?.role, "moderate");

  return (
    <div className="page container">
      <Link to={`/community`} className="meta">← {t("community.backToBoard")}</Link>
      <article className="thread-detail">
        <div className="thread-badges">
          {thread.is_pinned ? <span className="badge pin">{t("community.pinned")}</span> : null}
          {thread.is_featured ? <span className="badge feat">{t("community.featured")}</span> : null}
          {thread.is_locked ? <span className="badge lock">{t("community.locked")}</span> : null}
        </div>
        <h1>{thread.title}</h1>
        <div className="meta">
          <span className="chip op">{t("community.op")}</span> {thread.author?.name} · {date(thread.created_at)} ·{" "}
          {t("community.views", { n: thread.views })}
        </div>
        <div className="post-body floor-1">
          <Markdown source={thread.body} />
        </div>
        <div className="post-actions">
          <button onClick={likeThread}>👍 {t("community.likes", { n: thread.like_count })}</button>
          {canModerate && (
            <span className="mod-bar">
              {MOD_ACTIONS.map((a) => (
                <button key={a} className="mod-btn" onClick={() => moderate(a)}>
                  {t(`community.moderate.${a}`)}
                </button>
              ))}
            </span>
          )}
        </div>
      </article>

      <h2>{t("community.replies", { n: thread.reply_count })}</h2>
      {posts?.items.map((p) => (
        <div key={p.id} className="card post">
          <div className="post-head">
            <span className="floor">{t("community.floor", { n: p.floor })}</span>
            <span>{p.author?.name}</span>
            <span className="meta">{date(p.created_at)}</span>
          </div>
          <div className="post-body">
            <Markdown source={p.body} />
          </div>
          <button className="like-sm" onClick={() => likePost(p.id)}>
            👍 {p.like_count}
          </button>
        </div>
      ))}

      {posts && posts.total > posts.page_size && (
        <div className="pagination">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>←</button>
          <span>{page}</span>
          <button disabled={!posts.has_more} onClick={() => setPage((p) => p + 1)}>→</button>
        </div>
      )}

      {thread.is_locked ? (
        <p className="meta lock-note">{t("community.lockedNotice")}</p>
      ) : user ? (
        <form className="card compose" onSubmit={submitReply}>
          <textarea
            placeholder={t("community.replyPlaceholder")}
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            required
          />
          {error && <p className="error-msg">{error}</p>}
          <div className="modal-actions">
            <button className="primary" type="submit">{t("community.reply")}</button>
          </div>
        </form>
      ) : (
        <Link to="/account" className="meta">{t("community.needLogin")}</Link>
      )}
    </div>
  );
}
