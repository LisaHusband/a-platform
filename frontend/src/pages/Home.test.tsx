import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { card, page } from "../test/fixtures";
import { mockFetch, renderApp, setLang } from "../test/utils";
import Home from "./Home";

describe("Home", () => {
  it("renders principles and latest content", async () => {
    await setLang("zh");
    mockFetch({ "/contents": page([card]) });
    renderApp(<Home />);
    expect(screen.getByText("最新发布")).toBeInTheDocument();
    expect(screen.getByText(/去推荐算法/)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("测试内容标题")).toBeInTheDocument());
  });

  it("shows an error message on failure", async () => {
    await setLang("zh");
    mockFetch({ "/contents": new Error("加载失败") });
    renderApp(<Home />);
    await waitFor(() => expect(screen.getByText(/加载失败/)).toBeInTheDocument());
  });
});
