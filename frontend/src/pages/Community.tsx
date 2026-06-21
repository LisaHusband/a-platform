import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { api, Board } from "../api";

export default function Community() {
  const { t } = useTranslation();
  const [boards, setBoards] = useState<Board[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    api<Board[]>("/community/boards")
      .then(setBoards)
      .catch((e) => setError(String(e.message)));
  }, []);

  return (
    <div className="page container">
      <header className="section-hero">
        <h1>{t("community.title")}</h1>
        <p className="meta">{t("community.subtitle")}</p>
      </header>
      {error && <p className="error-msg">{t("common.error")}{error}</p>}
      <div className="board-grid">
        {boards.map((b) => (
          <Link key={b.id} to={`/community/${b.slug}`} className="board-card">
            <div className="board-emoji">💬</div>
            <h3>{b.name}</h3>
            <p className="meta">{b.description}</p>
            <span className="chip">{t("community.threads")} · {b.thread_count}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
