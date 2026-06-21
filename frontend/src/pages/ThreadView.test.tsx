import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { setToken } from "../api";
import { editor, page, post, reader, threadDetail } from "../test/fixtures";
import { mockFetch, renderApp, setLang } from "../test/utils";
import ThreadView from "./ThreadView";

function Harness() {
  return (
    <Routes>
      <Route path="/thread/:id" element={<ThreadView />} />
      <Route path="/account" element={<div>账户页</div>} />
    </Routes>
  );
}

describe("ThreadView", () => {
  it("renders the OP, floors and reply form when logged in", async () => {
    await setLang("zh");
    setToken("tok");
    const user = userEvent.setup();
    let replied = false;
    mockFetch({
      "/auth/me": reader,
      "POST /community/threads/1/posts": () => {
        replied = true;
        return post;
      },
      "/community/threads/1/posts": () => page(replied ? [post, post] : [post]),
      "/community/threads/1": threadDetail,
    });
    renderApp(<Harness />, { route: "/thread/1" });
    await waitFor(() => expect(screen.getByText("H100 性价比讨论")).toBeInTheDocument());
    expect(screen.getByText("二楼回复")).toBeInTheDocument();
    await user.type(screen.getByPlaceholderText(/理性发言/), "我的回复");
    await user.click(screen.getByRole("button", { name: "回复" }));
    await waitFor(() => expect(replied).toBe(true));
  });

  it("likes the thread", async () => {
    await setLang("zh");
    setToken("tok");
    const user = userEvent.setup();
    let liked = false;
    mockFetch({
      "/auth/me": reader,
      "/community/threads/1/posts": page([post]),
      "POST /community/threads/1/like": () => {
        liked = true;
        return { liked: true, like_count: 4 };
      },
      "/community/threads/1": threadDetail,
    });
    renderApp(<Harness />, { route: "/thread/1" });
    await waitFor(() => expect(screen.getByText("H100 性价比讨论")).toBeInTheDocument());
    // first 👍 is the thread-level like button (posts also have one)
    await user.click(screen.getAllByText(/👍/)[0]);
    await waitFor(() => expect(liked).toBe(true));
  });

  it("likes a post and paginates replies", async () => {
    await setLang("zh");
    setToken("tok");
    const user = userEvent.setup();
    let likedPost = false;
    const fetchMock = mockFetch({
      "/auth/me": reader,
      "POST /community/posts/5/like": () => {
        likedPost = true;
        return { liked: true, like_count: 2 };
      },
      "/community/threads/1/posts": page([post], 25),
      "/community/threads/1": threadDetail,
    });
    renderApp(<Harness />, { route: "/thread/1" });
    await waitFor(() => expect(screen.getByText("二楼回复")).toBeInTheDocument());
    // second 👍 is the post-level like
    await user.click(screen.getAllByText(/👍/)[1]);
    await waitFor(() => expect(likedPost).toBe(true));
    await user.click(screen.getByText("→"));
    await waitFor(() =>
      expect(fetchMock.mock.calls.some((c) => String(c[0]).includes("page=2"))).toBe(true),
    );
  });

  it("shows moderation bar for editors and applies an action", async () => {
    await setLang("zh");
    setToken("tok");
    const user = userEvent.setup();
    let moderated = false;
    mockFetch({
      "/auth/me": editor,
      "/community/threads/1/posts": page([post]),
      "POST /community/threads/1/moderate": () => {
        moderated = true;
        return threadDetail;
      },
      "/community/threads/1": threadDetail,
    });
    renderApp(<Harness />, { route: "/thread/1" });
    await waitFor(() => expect(screen.getByText("取消置顶")).toBeInTheDocument());
    await user.click(screen.getByText("锁定"));
    await waitFor(() => expect(moderated).toBe(true));
  });

  it("hides reply form on a locked thread", async () => {
    await setLang("zh");
    setToken("tok");
    mockFetch({
      "/auth/me": reader,
      "/community/threads/1/posts": page([post]),
      "/community/threads/1": { ...threadDetail, is_locked: 1 },
    });
    renderApp(<Harness />, { route: "/thread/1" });
    await waitFor(() => expect(screen.getByText(/该帖已锁定/)).toBeInTheDocument());
    expect(screen.queryByPlaceholderText(/理性发言/)).not.toBeInTheDocument();
  });

  it("shows an error when the thread fails to load", async () => {
    await setLang("zh");
    mockFetch({
      "/community/threads/1/posts": page([]),
      "/community/threads/1": new Error("帖子不存在"),
    });
    renderApp(<Harness />, { route: "/thread/1" });
    await waitFor(() => expect(screen.getByText(/帖子不存在/)).toBeInTheDocument());
  });
});
