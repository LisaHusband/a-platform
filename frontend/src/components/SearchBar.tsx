import { FormEvent, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { api } from "../api";

export default function SearchBar({ initial = "" }: { initial?: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [q, setQ] = useState(initial);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const timer = useRef<number>();

  useEffect(() => setQ(initial), [initial]);

  useEffect(() => {
    window.clearTimeout(timer.current);
    if (!q.trim() || q === initial) {
      setSuggestions([]);
      return;
    }
    timer.current = window.setTimeout(async () => {
      try {
        const s = await api<string[]>(`/search/suggest?q=${encodeURIComponent(q)}`);
        setSuggestions(s);
        setOpen(true);
      } catch {
        setSuggestions([]);
      }
    }, 180);
    return () => window.clearTimeout(timer.current);
  }, [q, initial]);

  function go(query: string) {
    setOpen(false);
    if (query.trim()) navigate(`/search?q=${encodeURIComponent(query.trim())}`);
  }
  function onSubmit(e: FormEvent) {
    e.preventDefault();
    go(q);
  }

  return (
    <div className="searchbar">
      <form onSubmit={onSubmit}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onBlur={() => window.setTimeout(() => setOpen(false), 150)}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          placeholder={t("search.placeholder")}
          aria-label={t("search.button")}
        />
        <button className="primary" type="submit">
          {t("search.button")}
        </button>
      </form>
      {open && suggestions.length > 0 && (
        <div className="suggest">
          {suggestions.map((s) => (
            <div key={s} onMouseDown={() => go(s)}>
              {s}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
