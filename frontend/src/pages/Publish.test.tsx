import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { setToken } from "../api";
import { author, card, rootCategory } from "../test/fixtures";
import { mockFetch, renderApp, setLang } from "../test/utils";

import Publish from "./Publish";

function Harness() {
  return (
    <Routes>
      <Route path="/publish" element={<Publish />} />
      <Route path="/content/:id" element={<div>内容详情</div>} />
      <Route path="/account" element={<div>账户页</div>} />
    </Routes>
  );
}

describe("Publish / Submit", () => {
  it("prompts login when logged out", async () => {
    await setLang("zh");
    mockFetch({ "/taxonomy/categories": [rootCategory] });
    renderApp(<Harness />, { route: "/publish" });
    await waitFor(() => expect(screen.getByText(/投稿需要先登录/)).toBeInTheDocument());
  });

  it("submits pasted content and shows success", async () => {
    await setLang("zh");
    setToken("tok");
    const user = userEvent.setup();
    mockFetch({
      "/auth/me": author,
      "/taxonomy/categories": [rootCategory],
      "POST /submissions": { ...card, id: 42 },
    });
    renderApp(<Harness />, { route: "/publish" });
    await waitFor(() => expect(screen.getByText("粘贴正文")).toBeInTheDocument());
    await user.type(screen.getByLabelText("标题"), "我的粘贴投稿标题");
    await user.type(screen.getByLabelText(/正文/), "正文内容足够长。");
    await user.click(screen.getByRole("button", { name: "提交投稿" }));
    await waitFor(() => expect(screen.getByText(/投稿成功/)).toBeInTheDocument());
    expect(screen.getByText(/查看内容/)).toBeInTheDocument();
  });

  it("submits a URL for crawling", async () => {
    await setLang("zh");
    setToken("tok");
    const user = userEvent.setup();
    let posted: { source_type?: string } = {};
    mockFetch({
      "/auth/me": author,
      "/taxonomy/categories": [rootCategory],
      "POST /submissions": (_u: string, init: RequestInit) => {
        posted = JSON.parse(String(init.body));
        return { ...card, id: 43 };
      },
    });
    renderApp(<Harness />, { route: "/publish" });
    await waitFor(() => expect(screen.getByText("提交网址")).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: "提交网址" }));
    await user.type(screen.getByLabelText(/网页 URL/), "https://example.com/post");
    await user.click(screen.getByRole("button", { name: "抓取并提交" }));
    await waitFor(() => expect(posted.source_type).toBe("url"));
  });

  it("shows an error when a URL submission is blocked", async () => {
    await setLang("zh");
    setToken("tok");
    const user = userEvent.setup();
    mockFetch({
      "/auth/me": author,
      "/taxonomy/categories": [rootCategory],
      "POST /submissions": new Error("Blocked by robots.txt"),
    });
    renderApp(<Harness />, { route: "/publish" });
    await waitFor(() => expect(screen.getByText("提交网址")).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: "提交网址" }));
    await user.type(screen.getByLabelText(/网页 URL/), "https://block.test/x");
    await user.click(screen.getByRole("button", { name: "抓取并提交" }));
    await waitFor(() => expect(screen.getByText(/Blocked by robots/)).toBeInTheDocument());
  });

  it("uploads a file and shows success", async () => {
    await setLang("zh");
    setToken("tok");
    const user = userEvent.setup();
    mockFetch({
      "/auth/me": author,
      "/taxonomy/categories": [rootCategory],
      "POST /submissions/file": { ...card, id: 50 },
    });
    renderApp(<Harness />, { route: "/publish" });
    await waitFor(() => expect(screen.getByText("上传文件")).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: "上传文件" }));
    await user.type(screen.getByLabelText("标题"), "文件投稿标题");
    const f = new File(["hello"], "note.txt", { type: "text/plain" });
    await user.upload(screen.getByLabelText(/选择文件/), f);
    await user.click(screen.getByRole("button", { name: "上传并提交" }));
    await waitFor(() => expect(screen.getByText(/投稿成功/)).toBeInTheDocument());
  });
});
