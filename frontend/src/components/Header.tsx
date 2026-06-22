import { useTranslation } from "react-i18next";
import { Link, NavLink, useSearchParams } from "react-router-dom";
import { roleCan, useApp } from "../context";
import SearchBar from "./SearchBar";

export default function Header() {
  const { t, i18n } = useTranslation();
  const { theme, toggleTheme, user } = useApp();
  const [params] = useSearchParams();

  // 角色化菜单：作者/编辑/专家/管理员可见工作台与投稿入口。
  // Role-aware menu: workbench/submit show for author/editor/expert/admin.
  const canSubmit = roleCan(user?.role, "submit");
  const canAdmin = roleCan(user?.role, "moderate");
  const hasWorkbench =
    canSubmit ||
    roleCan(user?.role, "reviewTier2") ||
    roleCan(user?.role, "reviewTier3") ||
    canAdmin;

  return (
    <header className="header">
      <div className="container header-inner">
        <Link to="/" className="logo">
          <span className="logo-mark">◆</span> {t("appName")}
        </Link>
        <SearchBar initial={params.get("q") ?? ""} />
        <nav className="nav">
          <NavLink to="/browse">{t("nav.browse")}</NavLink>
          <NavLink to="/graph">{t("nav.graph")}</NavLink>
          {canSubmit && <NavLink to="/publish">{t("nav.publish")}</NavLink>}
          {hasWorkbench && <NavLink to="/workbench">{t("nav.workbench")}</NavLink>}
          {canAdmin && <NavLink to="/admin">{t("nav.admin")}</NavLink>}
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
          {user && (
            <span className="wallet-badge" title={t("wallet.balance")}>
              ¥{user.balance.toFixed(0)}
            </span>
          )}
          <NavLink to="/account" className="account-link">
            {user ? user.name : t("nav.account")}
          </NavLink>
        </div>
      </div>
    </header>
  );
}
