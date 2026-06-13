import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { setToken } from "../api";
import { card, topic } from "../test/fixtures";
import { mockFetch, renderApp, setLang } from "../test/utils";
import Account from "./Account";

const reader = { id: 1, email: "reader@a.dev", name: "读者", role: "reader" };

/** The mode tab and the form submit share a label; the submit is the last. */
function submit(name: string | RegExp) {
  const buttons = screen.getAllByRole("button", { name });
  return buttons[buttons.length - 1];
}

describe("Account page (logged out)", () => {
  it("logs in and shows the dashboard", async () => {
    await setLang("zh");
    const user = userEvent.setup();
    mockFetch({
      "POST /auth/login": { token: "tok", user: reader },
      "/billing/purchases": [],
      "/billing/subscriptions": [],
      "/taxonomy/topics": [topic],
    });
    renderApp(<Account />, { route: "/account" });
    await user.type(screen.getByLabelText(/邮箱/), "reader@a.dev");
    await user.type(screen.getByLabelText(/密码/), "password123");
    await user.click(submit("登录"));
    await waitFor(() => expect(screen.getByText("读者")).toBeInTheDocument());
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
      "/billing/purchases": [],
      "/billing/subscriptions": [],
      "/taxonomy/topics": [topic],
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
      "/taxonomy/topics": [topic],
      ...overrides,
    });
    renderApp(<Account />, { route: "/account" });
    await waitFor(() => expect(screen.getByText("读者")).toBeInTheDocument());
  }

  it("lists subscriptions and purchases", async () => {
    await renderDashboard();
    expect(screen.getByText("测试内容标题")).toBeInTheDocument();
    expect(screen.getByText(/到期/)).toBeInTheDocument();
  });

  it("subscribes monthly", async () => {
    const user = userEvent.setup();
    let posted = false;
    await renderDashboard({
      "POST /billing/subscribe": () => {
        posted = true;
        return { id: 2, plan: "monthly", topic: null, started_at: "", expires_at: "2026-12-01T00:00:00Z" };
      },
    });
    await user.click(screen.getByRole("button", { name: /订阅全站/ }));
    await waitFor(() => expect(posted).toBe(true));
  });

  it("subscribes to a selected topic", async () => {
    const user = userEvent.setup();
    let body: unknown = null;
    await renderDashboard({
      "POST /billing/subscribe": (_url: string, init: RequestInit) => {
        body = JSON.parse(String(init.body));
        return { id: 3, plan: "topic", topic, started_at: "", expires_at: "2026-12-01T00:00:00Z" };
      },
    });
    const topicBtn = screen.getByRole("button", { name: /订阅专题/ });
    expect(topicBtn).toBeDisabled(); // disabled until a topic is chosen
    await user.selectOptions(screen.getAllByRole("combobox")[0], "ai-infra");
    expect(topicBtn).toBeEnabled();
    await user.click(topicBtn);
    await waitFor(() =>
      expect(body).toMatchObject({ plan: "topic", topic_slug: "ai-infra" }),
    );
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
