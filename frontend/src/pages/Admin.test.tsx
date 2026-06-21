import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { setToken } from "../api";
import { crawlSite, crawlTask, editor, page, reader, crawledCard, takedown } from "../test/fixtures";
import { mockFetch, renderApp, setLang } from "../test/utils";
import Admin from "./Admin";

function Harness() {
  return (
    <Routes>
      <Route path="/admin" element={<Admin />} />
      <Route path="/content/:id" element={<div>内容详情</div>} />
      <Route path="/account" element={<div>账户页</div>} />
    </Routes>
  );
}

describe("Admin console", () => {
  it("denies non-editors", async () => {
    await setLang("zh");
    setToken("tok");
    mockFetch({ "/auth/me": reader });
    renderApp(<Harness />, { route: "/admin" });
    await waitFor(() => expect(screen.getByText(/投稿需要先登录/)).toBeInTheDocument());
  });

  it("moderates content (approve)", async () => {
    await setLang("zh");
    setToken("tok");
    const user = userEvent.setup();
    let acted = "";
    mockFetch({
      "/auth/me": editor,
      "GET /admin/contents": page([{ ...crawledCard, status: "pending" }]),
      "POST /admin/contents/9/moderate": (_u: string, init: RequestInit) => {
        acted = JSON.parse(String(init.body)).action;
        return crawledCard;
      },
    });
    renderApp(<Harness />, { route: "/admin" });
    await waitFor(() => expect(screen.getByText("抓取内容标题")).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: "需修改" }));
    await user.click(screen.getByRole("button", { name: "拒绝" }));
    await user.click(screen.getByRole("button", { name: "归档" }));
    await user.click(screen.getByRole("button", { name: "通过发布" }));
    await waitFor(() => expect(acted).toBe("approve"));
    // switch status filter to exercise the select handler
    await user.selectOptions(screen.getByRole("combobox"), "published");
  });

  it("shows the crawl tab and enqueues a URL", async () => {
    await setLang("zh");
    setToken("tok");
    const user = userEvent.setup();
    let enq = false;
    mockFetch({
      "/auth/me": editor,
      "GET /admin/contents": page([]),
      "GET /crawl/tasks": [crawlTask],
      "POST /crawl/tasks": () => {
        enq = true;
        return crawlTask;
      },
    });
    renderApp(<Harness />, { route: "/admin" });
    await user.click(await screen.findByRole("button", { name: "抓取任务" }));
    await waitFor(() => expect(screen.getByPlaceholderText(/抓取网址/)).toBeInTheDocument());
    await user.type(screen.getByPlaceholderText(/抓取网址/), "https://example.com/new");
    await user.click(screen.getByRole("button", { name: "入队抓取" }));
    await waitFor(() => expect(enq).toBe(true));
  });

  it("checks robots in the crawl tab", async () => {
    await setLang("zh");
    setToken("tok");
    const user = userEvent.setup();
    mockFetch({
      "/auth/me": editor,
      "GET /admin/contents": page([]),
      "GET /crawl/tasks": [],
      "/crawl/check-robots": { allowed: false, decision: "disallowed", crawl_delay: null, robots_url: "x" },
    });
    renderApp(<Harness />, { route: "/admin" });
    await user.click(await screen.findByRole("button", { name: "抓取任务" }));
    await user.type(screen.getByPlaceholderText(/抓取网址/), "https://block.test/x");
    await user.click(screen.getByRole("button", { name: "检测 robots" }));
    await waitFor(() => expect(screen.getByText(/disallowed/)).toBeInTheDocument());
  });

  it("manages sites (add + blacklist toggle)", async () => {
    await setLang("zh");
    setToken("tok");
    const user = userEvent.setup();
    let added = false;
    mockFetch({
      "/auth/me": editor,
      "GET /admin/contents": page([]),
      "GET /crawl/sites": [crawlSite],
      "POST /crawl/sites": () => {
        added = true;
        return crawlSite;
      },
      "PATCH /crawl/sites/1": crawlSite,
    });
    renderApp(<Harness />, { route: "/admin" });
    await user.click(await screen.findByRole("button", { name: "站点管理" }));
    await waitFor(() => expect(screen.getByText("example.com")).toBeInTheDocument());
    await user.type(screen.getByPlaceholderText("域名"), "new.test");
    await user.click(screen.getByRole("button", { name: "新增站点" }));
    await waitFor(() => expect(added).toBe(true));
    // toggle blacklist on the existing site row
    await user.click(screen.getByRole("button", { name: "—" }));
  });

  it("resolves a takedown", async () => {
    await setLang("zh");
    setToken("tok");
    const user = userEvent.setup();
    let resolved = false;
    mockFetch({
      "/auth/me": editor,
      "GET /admin/contents": page([]),
      "GET /admin/takedowns": [takedown],
      "POST /admin/takedowns/1/resolve": () => {
        resolved = true;
        return { ...takedown, status: "resolved" };
      },
    });
    renderApp(<Harness />, { route: "/admin" });
    await user.click(await screen.findByRole("button", { name: "下架处理" }));
    await waitFor(() => expect(screen.getByText(/版权问题/)).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: "受理下架" }));
    await waitFor(() => expect(resolved).toBe(true));
  });
});
