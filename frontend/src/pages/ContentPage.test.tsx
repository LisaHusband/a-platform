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

  it("completes a wallet purchase and unlocks the body", async () => {
    await setLang("zh");
    setToken("tok");
    const user = userEvent.setup();
    let purchased = false;
    mockFetch({
      "/auth/me": { id: 1, email: "a@b.c", name: "买家", role: "reader", balance: 1000 },
      "/contents/1/related": [],
      "POST /payments": () => {
        purchased = true;
        return { order: { id: 1, status: "paid", method: "balance" }, approval_url: null, qr_code: null };
      },
      "/contents/1": () => (purchased ? unlockedDetail : lockedDetail),
    });
    renderApp(<Harness />, { route: "/content/1" });
    await waitFor(() => expect(screen.getByText(/购买本篇/)).toBeInTheDocument());
    await user.click(screen.getByText(/购买本篇/));
    // payment modal opens; pay with default wallet method
    await waitFor(() => expect(screen.getByText(/选择支付方式/)).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: /立即支付/ }));
    await waitFor(() =>
      expect(screen.getByText(/完整的正文内容在此/)).toBeInTheDocument(),
    );
  });

  it("runs the alipay sandbox flow with confirm callback", async () => {
    await setLang("zh");
    setToken("tok");
    const user = userEvent.setup();
    let confirmed = false;
    mockFetch({
      "/auth/me": { id: 1, email: "a@b.c", name: "买家", role: "reader", balance: 1000 },
      "/contents/1/related": [],
      "POST /payments/1/confirm": () => {
        confirmed = true;
        return { status: "paid" };
      },
      "POST /payments": {
        order: { id: 1, status: "created", method: "alipay" },
        approval_url: "https://sandbox.alipay.example/x",
        qr_code: "https://sandbox.alipay.example/x",
      },
      "/contents/1": () => (confirmed ? unlockedDetail : lockedDetail),
    });
    renderApp(<Harness />, { route: "/content/1" });
    await waitFor(() => expect(screen.getByText(/购买本篇/)).toBeInTheDocument());
    await user.click(screen.getByText(/购买本篇/));
    await user.click(screen.getByText(/支付宝（沙箱）/));
    await user.click(screen.getByRole("button", { name: /立即支付/ }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /我已完成支付/ })).toBeInTheDocument(),
    );
    await user.click(screen.getByRole("button", { name: /我已完成支付/ }));
    await waitFor(() =>
      expect(screen.getByText(/完整的正文内容在此/)).toBeInTheDocument(),
    );
  });

  it("cancels the payment modal", async () => {
    await setLang("zh");
    setToken("tok");
    const user = userEvent.setup();
    mockFetch({
      "/auth/me": { id: 1, email: "a@b.c", name: "买家", role: "reader", balance: 1000 },
      "/contents/1/related": [],
      "/contents/1": lockedDetail,
    });
    renderApp(<Harness />, { route: "/content/1" });
    await waitFor(() => expect(screen.getByText(/购买本篇/)).toBeInTheDocument());
    await user.click(screen.getByText(/购买本篇/));
    await waitFor(() => expect(screen.getByText(/选择支付方式/)).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: /取消/ }));
    await waitFor(() => expect(screen.queryByText(/选择支付方式/)).toBeNull());
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

  it("shows source domain without a link when no source URL", async () => {
    await setLang("zh");
    mockFetch({
      "/contents/1/related": [],
      "/contents/1": {
        ...unlockedDetail,
        source_type: "rss",
        source_url: "",
        source_domain: "feeds.example.com",
      },
    });
    renderApp(<Harness />, { route: "/content/1" });
    await waitFor(() => expect(screen.getByText(/feeds.example.com/)).toBeInTheDocument());
    expect(screen.queryByText(/查看原文/)).not.toBeInTheDocument();
  });

  it("shows source attribution and submits a takedown report", async () => {
    await setLang("zh");
    const user = userEvent.setup();
    let reported = false;
    mockFetch({
      "/contents/1/related": [],
      "/contents/1": {
        ...unlockedDetail,
        source_type: "crawl",
        source_url: "https://example.com/a",
        source_domain: "example.com",
        author_name: "原作者甲",
      },
      "POST /admin/takedowns": () => {
        reported = true;
        return { id: 1, content_id: 1, status: "open" };
      },
    });
    renderApp(<Harness />, { route: "/content/1" });
    await waitFor(() => expect(screen.getByText(/查看原文/)).toBeInTheDocument());
    expect(screen.getByText(/原作者甲/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /举报\/下架/ }));
    await user.type(screen.getByLabelText(/请说明原因/), "侵权内容");
    await user.click(screen.getByRole("button", { name: "提交请求" }));
    await waitFor(() => expect(reported).toBe(true));
    expect(screen.getByText(/已收到/)).toBeInTheDocument();
  });
});
