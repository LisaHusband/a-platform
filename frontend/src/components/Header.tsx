import { useTranslation } from "react-i18next";
import { Link, NavLink, useSearchParams } from "react-router-dom";
import { useApp } from "../context";
import SearchBar from "./SearchBar";

export default function Header() {
  const { t, i18n } = useTranslation();
  const { theme, toggleTheme, user } = useApp();
  const [params] = useSearchParams();

  return (
    <header className="header">
      <div className="container header-inner">
        <Link to="/" className="logo">
          {t("appName")}
        </Link>
        <SearchBar initial={params.get("q") ?? ""} />
        <nav className="nav">
          <NavLink to="/browse">{t("nav.browse")}</NavLink>
          <NavLink to="/graph">{t("nav.graph")}</NavLink>
          <NavLink to="/publish">{t("nav.publish")}</NavLink>
        </nav>
        <div className="header-actions">
          <button
            className="icon-btn"
            onClick={toggleTheme}
            title={t("common.theme")}
            aria-label={t("common.theme")}
          >
            {theme === "light" ? "🌙" : "☀️"}
          </button>
          <button
            className="icon-btn"
            onClick={() => i18n.changeLanguage(i18n.language.startsWith("zh") ? "en" : "zh")}
            title={t("common.lang")}
          >
            {i18n.language.startsWith("zh") ? "EN" : "中"}
          </button>
          <NavLink to="/account">{user ? user.name : t("nav.account")}</NavLink>
        </div>
      </div>
    </header>
  );
}
