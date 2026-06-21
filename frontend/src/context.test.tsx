import { act, renderHook, waitFor } from "@testing-library/react";
import { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { setToken } from "./api";
import { AppProvider, roleCan, useApp, useLocalName } from "./context";
import { mockFetch } from "./test/utils";
import { topic } from "./test/fixtures";

const wrapper = ({ children }: { children: ReactNode }) => <AppProvider>{children}</AppProvider>;

describe("AppProvider", () => {
  it("defaults to light theme and toggles + persists", () => {
    mockFetch({});
    const { result } = renderHook(() => useApp(), { wrapper });
    expect(result.current.theme).toBe("light");
    act(() => result.current.toggleTheme());
    expect(result.current.theme).toBe("dark");
    expect(localStorage.getItem("ap.theme")).toBe("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("honors the system dark-mode preference when no theme is saved", () => {
    window.matchMedia = vi.fn(() => ({ matches: true })) as unknown as typeof window.matchMedia;
    mockFetch({});
    const { result } = renderHook(() => useApp(), { wrapper });
    expect(result.current.theme).toBe("dark");
  });

  it("toggles dark back to light", () => {
    mockFetch({});
    const { result } = renderHook(() => useApp(), { wrapper });
    act(() => result.current.toggleTheme()); // light -> dark
    act(() => result.current.toggleTheme()); // dark -> light
    expect(result.current.theme).toBe("light");
  });

  it("login sets user+token, logout clears", () => {
    mockFetch({});
    const { result } = renderHook(() => useApp(), { wrapper });
    act(() =>
      result.current.login("tok", { id: 1, email: "a@b.c", name: "A", role: "reader" }),
    );
    expect(result.current.user?.name).toBe("A");
    act(() => result.current.logout());
    expect(result.current.user).toBeNull();
  });

  it("restores user from stored token on mount", async () => {
    setToken("existing");
    mockFetch({ "/auth/me": { id: 9, email: "x@y.z", name: "已登录", role: "editor" } });
    const { result } = renderHook(() => useApp(), { wrapper });
    await waitFor(() => expect(result.current.user?.name).toBe("已登录"));
  });

  it("clears token if /auth/me fails", async () => {
    setToken("bad");
    mockFetch({ "/auth/me": new Error("401") });
    renderHook(() => useApp(), { wrapper });
    await waitFor(() => expect(localStorage.getItem("ap.token")).toBeNull());
  });
});

describe("roleCan", () => {
  it("grants admin everything and gates others by capability", () => {
    expect(roleCan("admin", "publish")).toBe(true);
    expect(roleCan("editor", "reviewTier2")).toBe(true);
    expect(roleCan("expert", "reviewTier3")).toBe(true);
    expect(roleCan("author", "submit")).toBe(true);
    expect(roleCan("reader", "submit")).toBe(false);
    expect(roleCan(undefined, "submit")).toBe(false);
    expect(roleCan("editor", "unknown-cap")).toBe(false);
  });
});

describe("useLocalName", () => {
  it("returns zh or en name by language, empty for nullish", async () => {
    const { result } = renderHook(() => useLocalName());
    expect(result.current(topic)).toBeTruthy();
    expect(result.current(null)).toBe("");
  });
});
