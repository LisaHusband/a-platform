import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { setToken } from "../api";
import { setLang, mockFetch, renderApp } from "../test/utils";
import Header from "./Header";

describe("Header", () => {
  it("renders logo and nav links", async () => {
    await setLang("zh");
    mockFetch({});
    renderApp(<Header />);
    expect(screen.getByText("A-PLATFORM")).toBeInTheDocument();
    expect(screen.getByText("浏览")).toBeInTheDocument();
    expect(screen.getByText("知识图谱")).toBeInTheDocument();
  });

  it("toggles theme via button", async () => {
    await setLang("zh");
    const user = userEvent.setup();
    mockFetch({});
    renderApp(<Header />);
    const themeBtn = screen.getByRole("button", { name: "主题" });
    await user.click(themeBtn);
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("switches language", async () => {
    await setLang("zh");
    const user = userEvent.setup();
    mockFetch({});
    renderApp(<Header />);
    await user.click(screen.getByText("EN"));
    await waitFor(() => expect(screen.getByText("Browse")).toBeInTheDocument());
    await setLang("zh");
  });

  it("switches language back from English to Chinese", async () => {
    await setLang("en");
    const user = userEvent.setup();
    mockFetch({});
    renderApp(<Header />);
    expect(screen.getByText("Browse")).toBeInTheDocument();
    await user.click(screen.getByText("中"));
    await waitFor(() => expect(screen.getByText("浏览")).toBeInTheDocument());
  });

  it("shows the logged-in user's name and wallet badge", async () => {
    await setLang("zh");
    setToken("tok");
    mockFetch({
      "/auth/me": { id: 1, email: "a@b.c", name: "登录者", role: "reader", balance: 1000 },
    });
    renderApp(<Header />);
    await waitFor(() => expect(screen.getByText("登录者")).toBeInTheDocument());
    expect(screen.getByText("¥1000")).toBeInTheDocument();
  });

  it("shows role-specific nav for an editor", async () => {
    await setLang("zh");
    setToken("tok");
    mockFetch({
      "/auth/me": { id: 3, email: "e@a.dev", name: "编辑", role: "editor", balance: 1000 },
    });
    renderApp(<Header />);
    await waitFor(() => expect(screen.getByText("工作台")).toBeInTheDocument());
    expect(screen.getByText("投稿")).toBeInTheDocument();
  });
});
