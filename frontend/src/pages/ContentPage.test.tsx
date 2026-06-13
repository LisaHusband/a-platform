import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { setToken } from "../api";
import { card, lockedDetail, unlockedDetail } from "../test/fixtures";
import { mockFetch, renderApp, setLang } from "../test/utils";
import ContentPage from "./ContentPage";

function Harness() {
  return (
    <Routes>
      <Route path="/content/:id" element={<ContentPage />} />
      <Route path="/account" element={<div>账户页</div>} />
    </Routes>
  );
}

describe("ContentPage", () => {
  it("shows loading then the locked preview with a buy button", async () => {
    await setLang("zh");
    mockFetch({ "/contents/1/related": [], "/contents/1": lockedDetail });
    renderApp(<Harness />, { route: "/content/1" });
    await waitFor(() => expect(screen.getByText("测试内容标题")).toBeInTheDocument());
    expect(screen.getByText(/内容预览/)).toBeInTheDocument();
    expect(screen.getByText(/购买本篇/)).toBeInTheDocument();
  });

  it("renders full body and sources when access is granted", async () => {
    await setLang("zh");
    mockFetch({ "/contents/1/related": [card], "/contents/1": unlockedDetail });
    renderApp(<Harness />, { route: "/content/1" });
    await waitFor(() =>
      expect(screen.getByText(/完整的正文内容在此/)).toBeInTheDocument(),
    );
    expect(screen.getByText(/引用来源/)).toBeInTheDocument();
    expect(screen.getByText(/编辑关联内容/)).toBeInTheDocument();
  });

  it("toggles reading mode and adjusts font size", async () => {
    await setLang("zh");
    const user = userEvent.setup();
    mockFetch({ "/contents/1/related": [], "/contents/1": unlockedDetail });
    renderApp(<Harness />, { route: "/content/1" });
    await waitFor(() => expect(screen.getByText(/阅读模式/)).toBeInTheDocument());
    await user.click(screen.getByText("阅读模式"));
    expect(document.body.classList.contains("reading-mode")).toBe(true);
    await user.click(screen.getByText("A+"));
    await user.click(screen.getByText("A−"));
    await user.click(screen.getByText(/退出阅读模式/));
    expect(document.body.classList.contains("reading-mode")).toBe(false);
  });

  it("redirects to /account when buying while logged out", async () => {
    await setLang("zh");
    const user = userEvent.setup();
    mockFetch({ "/contents/1/related": [], "/contents/1": lockedDetail });
    renderApp(<Harness />, { route: "/content/1" });
    await waitFor(() => expect(screen.getByText(/购买本篇/)).toBeInTheDocument());
    await user.click(screen.getByText(/购买本篇/));
    await waitFor(() => expect(screen.getByText("账户页")).toBeInTheDocument());
  });

  it("completes a purchase and unlocks the body when logged in", async () => {
    await setLang("zh");
    setToken("tok");
    const user = userEvent.setup();
    let purchased = false;
    mockFetch({
      "/auth/me": { id: 1, email: "a@b.c", name: "买家", role: "reader" },
      "/contents/1/related": [],
      "POST /billing/purchase/1": () => {
        purchased = true;
        return { id: 1, content: card, price_paid: 12, created_at: "" };
      },
      "/contents/1": () => (purchased ? unlockedDetail : lockedDetail),
    });
    renderApp(<Harness />, { route: "/content/1" });
    await waitFor(() => expect(screen.getByText(/购买本篇/)).toBeInTheDocument());
    await user.click(screen.getByText(/购买本篇/));
    await waitFor(() =>
      expect(screen.getByText(/完整的正文内容在此/)).toBeInTheDocument(),
    );
  });

  it("surfaces an error when the purchase call fails", async () => {
    await setLang("zh");
    setToken("tok");
    const user = userEvent.setup();
    mockFetch({
      "/auth/me": { id: 1, email: "a@b.c", name: "买家", role: "reader" },
      "/contents/1/related": [],
      "POST /billing/purchase/1": new Error("支付失败"),
      "/contents/1": lockedDetail,
    });
    renderApp(<Harness />, { route: "/content/1" });
    await waitFor(() => expect(screen.getByText(/购买本篇/)).toBeInTheDocument());
    await user.click(screen.getByText(/购买本篇/));
    await waitFor(() => expect(screen.getByText(/支付失败/)).toBeInTheDocument());
  });

  it("handles content without a publish date", async () => {
    await setLang("zh");
    mockFetch({
      "/contents/1/related": [],
      "/contents/1": { ...unlockedDetail, published_at: null, sources: "" },
    });
    renderApp(<Harness />, { route: "/content/1" });
    await waitFor(() =>
      expect(screen.getByText(/完整的正文内容在此/)).toBeInTheDocument(),
    );
    // no sources section when sources empty
    expect(screen.queryByText(/引用来源/)).not.toBeInTheDocument();
  });

  it("shows an error when the content fails to load", async () => {
    await setLang("zh");
    mockFetch({ "/contents/1/related": [], "/contents/1": new Error("未找到") });
    renderApp(<Harness />, { route: "/content/1" });
    await waitFor(() => expect(screen.getByText(/未找到/)).toBeInTheDocument());
  });
});
