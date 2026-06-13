import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { setToken } from "../api";
import { rootCategory } from "../test/fixtures";
import { mockFetch, renderApp, setLang } from "../test/utils";
import Publish from "./Publish";

const author = { id: 4, email: "author@a.dev", name: "作者", role: "author" };

const tier1Pass = {
  passed: true,
  score: 95,
  status: "tier1_passed",
  rules: [
    { rule: "min-length", passed: true, message: "长度足够", penalty: 0 },
    { rule: "cited-sources", passed: true, message: "包含引用", penalty: 0 },
  ],
};

describe("Publish page", () => {
  it("prompts to log in when no user", async () => {
    await setLang("zh");
    mockFetch({ "/taxonomy/categories": [rootCategory] });
    renderApp(<Publish />, { route: "/publish" });
    await waitFor(() => expect(screen.getByText(/投稿需要先登录/)).toBeInTheDocument());
  });

  it("submits content and shows the Tier-1 result", async () => {
    await setLang("zh");
    setToken("tok");
    const user = userEvent.setup();
    mockFetch({
      "/auth/me": author,
      "/taxonomy/categories": [rootCategory],
      "POST /contents": { id: 99 },
      "POST /review/99/tier1": tier1Pass,
    });
    renderApp(<Publish />, { route: "/publish" });
    await waitFor(() => expect(screen.getByText(/^投稿$/)).toBeInTheDocument());

    await user.type(screen.getByLabelText("标题"), "一个足够长的研究标题");
    await user.type(screen.getByLabelText(/正文/), "## 章节\n\n正文内容。".repeat(5));
    await user.click(screen.getByRole("button", { name: /提交并运行/ }));

    await waitFor(() =>
      expect(screen.getByText(/Tier-1 规则审核结果/)).toBeInTheDocument(),
    );
    expect(screen.getByText(/min-length/)).toBeInTheDocument();
    expect(screen.getByText(/通过/)).toBeInTheDocument();
  });

  it("renders a failing Tier-1 result with penalties and edits price/category", async () => {
    await setLang("zh");
    setToken("tok");
    const user = userEvent.setup();
    const tier1Fail = {
      passed: false,
      score: 55,
      status: "rejected",
      rules: [
        { rule: "min-length", passed: false, message: "太短", penalty: 0 },
        { rule: "structured", passed: false, message: "缺少结构", penalty: 15 },
      ],
    };
    mockFetch({
      "/auth/me": author,
      "/taxonomy/categories": [rootCategory],
      "POST /contents": { id: 7 },
      "POST /review/7/tier1": tier1Fail,
    });
    renderApp(<Publish />, { route: "/publish" });
    await waitFor(() => expect(screen.getByText(/^投稿$/)).toBeInTheDocument());
    await user.type(screen.getByLabelText("标题"), "一个足够长的研究标题");
    await user.type(screen.getByLabelText(/正文/), "正文。");
    await user.clear(screen.getByLabelText(/定价/));
    await user.type(screen.getByLabelText(/定价/), "9");
    await user.selectOptions(screen.getByLabelText(/分类/), "1");
    await user.click(screen.getByRole("button", { name: /提交并运行/ }));
    await waitFor(() => expect(screen.getByText(/未通过/)).toBeInTheDocument());
    expect(screen.getByText(/-15/)).toBeInTheDocument();
  });

  it("shows an error when submission fails", async () => {
    await setLang("zh");
    setToken("tok");
    const user = userEvent.setup();
    mockFetch({
      "/auth/me": author,
      "/taxonomy/categories": [rootCategory],
      "POST /contents": new Error("提交失败"),
    });
    renderApp(<Publish />, { route: "/publish" });
    await waitFor(() => expect(screen.getByText(/^投稿$/)).toBeInTheDocument());
    await user.type(screen.getByLabelText("标题"), "一个足够长的研究标题");
    await user.type(screen.getByLabelText(/正文/), "正文内容足够。");
    await user.click(screen.getByRole("button", { name: /提交并运行/ }));
    await waitFor(() => expect(screen.getByText("提交失败")).toBeInTheDocument());
  });
});
