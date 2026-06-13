import DOMPurify from "dompurify";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router-dom";
import { api, SearchOut } from "../api";
import ContentCardView from "../components/ContentCardView";

const OPERATORS = [
  '"exact phrase"',
  "-exclude",
  "tag:llm",
  "category:tech",
  "topic:ai-infra",
  "type:report",
  "lang:en",
  "author:name",
  "before:2026-01-01",
  "after:2025-06-01",
];

export default function Search() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "";
  const sort = params.get("sort") ?? "relevance";
  const page = Number(params.get("page") ?? "1");
  const [result, setResult] = useState<SearchOut | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!q) return;
    setError("");
    api<SearchOut>(
      `/search?q=${encodeURIComponent(q)}&sort=${sort}&page=${page}`,
    )
      .then(setResult)
      .catch((e) => setError(String(e.message)));
  }, [q, sort, page]);

  function update(key: string, value: string) {
    const next = new URLSearchParams(params);
    next.set(key, value);
    if (key !== "page") next.set("page", "1");
    setParams(next);
  }

  const pages = result ? Math.max(1, Math.ceil(result.total / result.page_size)) : 1;

  return (
    <div className="page container">
      <div className="toolbar">
        {result && (
          <span className="meta">
            {t("search.results", { total: result.total, ms: result.took_ms })}
          </span>
        )}
        <select value={sort} onChange={(e) => update("sort", e.target.value)}>
          {(["relevance", "newest", "oldest", "title"] as const).map((s) => (
            <option key={s} value={s}>
              {t(`search.sort.${s}`)}
            </option>
          ))}
        </select>
        <details>
          <summary>{t("search.operators")}</summary>
          <div className="explain">{OPERATORS.join("   ")}</div>
        </details>
      </div>

      {error && <p className="error-msg">{t("common.error")}{error}</p>}

      {result?.did_you_mean && (
        <p className="dym">
          {t("search.didYouMean")}{" "}
          <Link to={`/search?q=${encodeURIComponent(result.did_you_mean)}`}>
            <strong>{result.did_you_mean}</strong>
          </Link>
        </p>
      )}

      {result && result.hits.length === 0 && <p>{t("search.noResults")}</p>}

      {result?.hits.map((hit) => (
        <ContentCardView key={hit.content.id} content={hit.content}>
          <p
            className="snippet"
            dangerouslySetInnerHTML={{
              __html: DOMPurify.sanitize(hit.snippet, { ALLOWED_TAGS: ["mark"] }),
            }}
          />
          <details>
            <summary>{t("search.whyRanked")}（score {hit.score}）</summary>
            <div className="explain">
              <div className="explain-title">{t("search.explainTitle")}</div>
              {hit.explanation.join("\n")}
            </div>
          </details>
        </ContentCardView>
      ))}

      {result && pages > 1 && (
        <div className="pagination">
          <button disabled={page <= 1} onClick={() => update("page", String(page - 1))}>
            ←
          </button>
          <span>
            {page} / {pages}
          </span>
          <button disabled={page >= pages} onClick={() => update("page", String(page + 1))}>
            →
          </button>
        </div>
      )}
    </div>
  );
}
