import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { setToken } from "../api";
import { author, card, editor, reader } from "../test/fixtures";
import { mockFetch, renderApp, setLang } from "../test/utils";
import Workbench from "./Workbench";

function Harness() {
  return (
    <Routes>
      <Route path="/workbench" element={<Workbench />} />
      <Route path="/account" element={<div>账户页</div>} />
      <Route path="/content/:id" element={<div>内容页</div>} />
    </Routes>
  );
}

describe("Workbench", () => {
  it("prompts login when logged out", async () => {
    await setLang("zh");
    mockFetch({});
    renderApp(<Harness />, { route: "/workbench" });
    await waitFor(() => expect(screen.getByText(/投稿需要先登录/)).toBeInTheDocument());
  });

  it("shows the submit tool for an author and no review queue", async () => {
    await setLang("zh");
    setToken("tok");
    mockFetch({ "/auth/me": author });
    renderApp(<Harness />, { route: "/workbench" });
    await waitFor(() => expect(screen.getByText("投稿创作")).toBeInTheDocument());
    expect(screen.queryByText("编辑审核队列")).toBeNull();
  });

  it("shows the editor review queue and runs actions", async () => {
    await setLang("zh");
    setToken("tok");
    const user = userEvent.setup();
    const acted: string[] = [];
    mockFetch({
      "/auth/me": editor,
      "/review/queue": [{ ...card, status: "tier1_passed" }],
      "POST /review/1/tier2": (url: string) => {
        acted.push(url);
        return { status: "tier2_passed" };
      },
      "POST /contents/1/publish": (url: string) => {
        acted.push(url);
        return card;
      },
    });
    renderApp(<Harness />, { route: "/workbench" });
    // "编辑审核队列" appears as both a tool card and the queue section heading
    await waitFor(() => expect(screen.getByRole("button", { name: "通过" })).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: "发布" }));
    await user.click(screen.getByRole("button", { name: "驳回" }));
    await user.click(screen.getByRole("button", { name: "通过" }));
    await waitFor(() => expect(acted.some((u) => u.includes("/tier2"))).toBe(true));
    expect(acted.some((u) => u.includes("/publish"))).toBe(true);
  });

  it("shows the expert tier-3 queue", async () => {
    await setLang("zh");
    setToken("tok");
    const user = userEvent.setup();
    const acted: string[] = [];
    mockFetch({
      "/auth/me": { ...author, role: "expert", name: "专家小王" },
      "/review/queue": [{ ...card, status: "tier2_passed" }],
      "POST /review/1/tier3": (url: string) => {
        acted.push(url);
        return { status: "tier2_passed" };
      },
    });
    renderApp(<Harness />, { route: "/workbench" });
    await waitFor(() => expect(screen.getByRole("button", { name: "通过" })).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: "通过" }));
    await waitFor(() => expect(acted.some((u) => u.includes("/tier3"))).toBe(true));
  });

  it("shows no tools for a plain reader", async () => {
    await setLang("zh");
    setToken("tok");
    mockFetch({ "/auth/me": reader });
    renderApp(<Harness />, { route: "/workbench" });
    await waitFor(() => expect(screen.getByText(/当前角色暂无专属功能/)).toBeInTheDocument());
  });
});
