import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { api, getToken, Named, setToken, User } from "./api";

type Theme = "light" | "dark";

interface AppCtx {
  theme: Theme;
  toggleTheme: () => void;
  user: User | null;
  login: (token: string, user: User) => void;
  logout: () => void;
  refreshUser: () => void;
}

const Ctx = createContext<AppCtx>(null!);

export function AppProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem("ap.theme");
    if (saved === "light" || saved === "dark") return saved;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("ap.theme", theme);
  }, [theme]);

  useEffect(() => {
    if (getToken()) {
      api<User>("/auth/me")
        .then(setUser)
        .catch(() => setToken(null));
    }
  }, []);

  const toggleTheme = useCallback(
    () => setTheme((t) => (t === "light" ? "dark" : "light")),
    [],
  );
  const login = useCallback((token: string, u: User) => {
    setToken(token);
    setUser(u);
  }, []);
  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);
  const refreshUser = useCallback(() => {
    if (getToken()) api<User>("/auth/me").then(setUser).catch(() => {});
  }, []);

  return (
    <Ctx.Provider value={{ theme, toggleTheme, user, login, logout, refreshUser }}>
      {children}
    </Ctx.Provider>
  );
}

/** Tools a role can access in the workbench / nav. Admin sees everything. */
export function roleCan(role: string | undefined, capability: string): boolean {
  if (!role) return false;
  const matrix: Record<string, string[]> = {
    submit: ["author", "editor", "admin"],
    reviewTier2: ["editor", "admin"],
    reviewTier3: ["expert", "admin"],
    publish: ["editor", "admin"],
    moderate: ["editor", "admin"],
    boards: ["editor", "admin"],
  };
  return role === "admin" || (matrix[capability]?.includes(role) ?? false);
}

export const useApp = () => useContext(Ctx);

/** Pick the zh/en display name of a taxonomy item by current UI language. */
export function useLocalName() {
  const { i18n } = useTranslation();
  return useCallback(
    (item: Named | null | undefined) =>
      item ? (i18n.language.startsWith("zh") ? item.name_zh : item.name_en) : "",
    [i18n.language],
  );
}
