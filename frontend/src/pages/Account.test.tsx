import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { setToken } from "../api";
import { card, order, reader, topic } from "../test/fixtures";
import { mockFetch, renderApp, setLang } from "../test/utils";
import Account from "./Account";

/** The mode tab and the form submit share a label; the submit is the last. */
function submit(name: string | RegExp) {
  const buttons = screen.getAllByRole("button", { name });
  return buttons[buttons.length - 1];
}

describe("Account page (logged out)", () => {
  const authRoutes = {
    "/billing/purchases": [],
    "/billing/subscriptions": [],
    "/payments": [],
    "/taxonomy/topics": [topic],
  };

  it("logs in and shows the dashboard", async () => {
    await setLang("zh");
    const user = userEvent.setup();
    mockFetch({ "POST /auth/login": { token: "tok", user: reader }, ...authRoutes });
    renderApp(<Account />, { route: "/account" });
    await user.type(screen.getByLabelText(/邮箱/), "reader@a.dev");
    await user.type(screen.getByLabelText(/密码/), "password123");
    await user.click(submit("登录"));
    await waitFor(() => expect(screen.getByText("读者小明")).toBeInTheDocument());
    // wallet card shows the free balance
    expect(screen.getByText("¥1000.00")).toBeInTheDocument();
  });

  it("shows a login error", async () => {
    await setLang("zh");
    const user = userEvent.setup();
    mockFetch({ "POST /auth/login": new Error("凭据无效") });
    renderApp(<Account />, { route: "/account" });
    await user.type(screen.getByLabelText(/邮箱/), "x@a.dev");
    await user.type(screen.getByLabelText(/密码/), "password123");
    await user.click(submit("登录"));
    await waitFor(() => expect(screen.getByText("凭据无效")).toBeInTheDocument());
  });

  it("registers a new account", async () => {
    await setLang("zh");
    const user = userEvent.setup();
    mockFetch({
      "POST /auth/register": { token: "tok", user: { ...reader, name: "新人" } },
      ...authRoutes,
    });
    renderApp(<Account />, { route: "/account" });
    await user.click(screen.getByRole("button", { name: "注册" })); // switch mode
    await user.type(screen.getByLabelText(/邮箱/), "new@a.dev");
    await user.type(screen.getByLabelText(/昵称/), "新人");
    await user.type(screen.getByLabelText(/密码/), "password123");
    await user.click(submit("注册"));
    await waitFor(() => expect(screen.getByText("新人")).toBeInTheDocument());
  });
});

describe("Account dashboard (logged in)", () => {
  async function renderDashboard(overrides = {}) {
    await setLang("zh");
    setToken("tok");
    mockFetch({
      "/auth/me": reader,
      "/billing/purchases": [{ id: 1, content: card, price_paid: 12, created_at: "" }],
      "/billing/subscriptions": [
        {
          id: 1,
          plan: "topic",
          topic,
          started_at: "2026-01-01T00:00:00Z",
          expires_at: "2026-12-01T00:00:00Z",
        },
      ],
      "GET /payments": [order],
      "/taxonomy/topics": [topic],
      ...overrides,
    });
    renderApp(<Account />, { route: "/account" });
    await waitFor(() => expect(screen.getByText("读者小明")).toBeInTheDocument());
  }

  it("lists subscriptions, purchases and payment orders", async () => {
    await renderDashboard();
    expect(screen.getByText("测试内容标题")).toBeInTheDocument();
    expect(screen.getByText(/到期/)).toBeInTheDocument();
    // payment history table shows the order status
    expect(screen.getByText("created")).toBeInTheDocument();
  });

  it("opens the payment modal for a monthly subscription", async () => {
    const user = userEvent.setup();
    await renderDashboard();
    await user.click(screen.getByRole("button", { name: /订阅全站/ }));
    await waitFor(() => expect(screen.getByText(/选择支付方式/)).toBeInTheDocument());
  });

  it("completes a monthly subscription via wallet and closes the modal", async () => {
    const user = userEvent.setup();
    await renderDashboard({
      "POST /payments": { order: { id: 9, status: "paid", method: "balance" } },
    });
    await user.click(screen.getByRole("button", { name: /订阅全站/ }));
    await waitFor(() => expect(screen.getByText(/选择支付方式/)).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: /立即支付/ }));
    await waitFor(() => expect(screen.queryByText(/选择支付方式/)).toBeNull());
  });

  it("opens the payment modal for a selected topic", async () => {
    const user = userEvent.setup();
    await renderDashboard();
    const topicBtn = screen.getByRole("button", { name: /订阅专题/ });
    expect(topicBtn).toBeDisabled();
    await user.selectOptions(screen.getAllByRole("combobox")[0], "ai-infra");
    expect(topicBtn).toBeEnabled();
    await user.click(topicBtn);
    await waitFor(() => expect(screen.getByText(/选择支付方式/)).toBeInTheDocument());
  });

  it("cancels the subscription payment modal", async () => {
    const user = userEvent.setup();
    await renderDashboard();
    await user.click(screen.getByRole("button", { name: /订阅全站/ }));
    await waitFor(() => expect(screen.getByText(/选择支付方式/)).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: /取消/ }));
    await waitFor(() => expect(screen.queryByText(/选择支付方式/)).toBeNull());
  });

  it("logs out", async () => {
    const user = userEvent.setup();
    await renderDashboard();
    await user.click(screen.getByRole("button", { name: /退出登录/ }));
    await waitFor(() =>
      expect(screen.getAllByRole("button", { name: "登录" }).length).toBeGreaterThan(0),
    );
  });
});
