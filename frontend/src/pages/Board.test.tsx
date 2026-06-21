import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { setToken } from "../api";
import { page, reader, threadCard, threadDetail } from "../test/fixtures";
import { mockFetch, renderApp, setLang } from "../test/utils";
import Board from "./Board";

function Harness() {
  return (
    <Routes>
      <Route path="/community/:slug" element={<Board />} />
      <Route path="/thread/:id" element={<div>帖子详情</div>} />
      <Route path="/account" element={<div>账户页</div>} />
    </Routes>
  );
}

describe("Board", () => {
  it("lists threads with badges", async () => {
    await setLang("zh");
    mockFetch({ "/community/boards/ai-infra/threads": page([threadCard]) });
    renderApp(<Harness />, { route: "/community/ai-infra" });
    await waitFor(() => expect(screen.getByText("H100 性价比讨论")).toBeInTheDocument());
    expect(screen.getByText("置顶")).toBeInTheDocument();
    expect(screen.getByText("精华")).toBeInTheDocument();
  });

  it("prompts login when logged out", async () => {
    await setLang("zh");
    mockFetch({ "/community/boards/ai-infra/threads": page([threadCard]) });
    renderApp(<Harness />, { route: "/community/ai-infra" });
    await waitFor(() => expect(screen.getByText(/登录后即可发帖/)).toBeInTheDocument());
  });

  it("lets a logged-in user create a thread", async () => {
    await setLang("zh");
    setToken("tok");
    const user = userEvent.setup();
    let created = false;
    mockFetch({
      "/auth/me": reader,
      "POST /community/boards/ai-infra/threads": () => {
        created = true;
        return threadDetail;
      },
      "/community/boards/ai-infra/threads": () => page(created ? [threadCard, threadCard] : [threadCard]),
    });
    renderApp(<Harness />, { route: "/community/ai-infra" });
    await waitFor(() => expect(screen.getByText(/发新帖/)).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: /发新帖/ }));
    await user.type(screen.getByPlaceholderText("标题"), "我的新帖标题");
    await user.type(screen.getByPlaceholderText("正文"), "正文内容");
    await user.click(screen.getByRole("button", { name: "发表" }));
    await waitFor(() => expect(created).toBe(true));
  });

  it("navigates to a thread", async () => {
    await setLang("zh");
    const user = userEvent.setup();
    mockFetch({ "/community/boards/ai-infra/threads": page([threadCard]) });
    renderApp(<Harness />, { route: "/community/ai-infra" });
    await waitFor(() => expect(screen.getByText("H100 性价比讨论")).toBeInTheDocument());
    await user.click(screen.getByText("H100 性价比讨论"));
    await waitFor(() => expect(screen.getByText("帖子详情")).toBeInTheDocument());
  });

  it("changes sort, searches and paginates", async () => {
    await setLang("zh");
    const user = userEvent.setup();
    const fetchMock = mockFetch({
      "/community/boards/ai-infra/threads": page([threadCard], 30),
    });
    renderApp(<Harness />, { route: "/community/ai-infra" });
    await waitFor(() => expect(screen.getByText("H100 性价比讨论")).toBeInTheDocument());
    await user.selectOptions(screen.getByRole("combobox"), "hot");
    await waitFor(() =>
      expect(fetchMock.mock.calls.some((c) => String(c[0]).includes("sort=hot"))).toBe(true),
    );
    await user.type(screen.getByPlaceholderText(/搜索帖子/), "H100{Enter}");
    await waitFor(() =>
      expect(fetchMock.mock.calls.some((c) => String(c[0]).includes("q=H100"))).toBe(true),
    );
    await user.click(screen.getByText("→"));
    await waitFor(() =>
      expect(fetchMock.mock.calls.some((c) => String(c[0]).includes("page=2"))).toBe(true),
    );
  });

  it("cancels the compose form", async () => {
    await setLang("zh");
    setToken("tok");
    const user = userEvent.setup();
    mockFetch({ "/auth/me": reader, "/community/boards/ai-infra/threads": page([threadCard]) });
    renderApp(<Harness />, { route: "/community/ai-infra" });
    await waitFor(() => expect(screen.getByText(/发新帖/)).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: /发新帖/ }));
    expect(screen.getByPlaceholderText("标题")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /取消/ }));
    await waitFor(() => expect(screen.queryByPlaceholderText("标题")).toBeNull());
  });

  it("shows empty state", async () => {
    await setLang("zh");
    mockFetch({ "/community/boards/ai-infra/threads": page([]) });
    renderApp(<Harness />, { route: "/community/ai-infra" });
    await waitFor(() => expect(screen.getByText(/还没有主题帖/)).toBeInTheDocument());
  });
});
