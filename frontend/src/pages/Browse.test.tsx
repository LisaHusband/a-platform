import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { card, category, page, rootCategory, tag, topic } from "../test/fixtures";
import { mockFetch, renderApp, setLang } from "../test/utils";
import Browse from "./Browse";

function routes(contents = [card]) {
  return {
    "/taxonomy/categories": [rootCategory, category],
    "/taxonomy/tags": [tag],
    "/taxonomy/topics": [topic],
    "/contents": page(contents),
  };
}

describe("Browse page", () => {
  function setup(contents = [card]) {
    const fetchMock = mockFetch(routes(contents));
    const { container } = renderApp(<Browse />, { route: "/browse" });
    const sidebar = () => within(container.querySelector(".sidebar") as HTMLElement);
    return { fetchMock, sidebar };
  }

  it("renders sidebar taxonomy and content list", async () => {
    await setLang("zh");
    const { sidebar } = setup();
    await waitFor(() => expect(sidebar().getByText("技术")).toBeInTheDocument());
    expect(sidebar().getByText("AI 系统")).toBeInTheDocument();
    expect(sidebar().getByText("AI 基础设施")).toBeInTheDocument();
    expect(screen.getByText("测试内容标题")).toBeInTheDocument();
  });

  it("filters by category when clicked", async () => {
    await setLang("zh");
    const user = userEvent.setup();
    const { fetchMock, sidebar } = setup();
    await waitFor(() => expect(sidebar().getByText("技术")).toBeInTheDocument());
    await user.click(sidebar().getByText("AI 系统"));
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some((c) => String(c[0]).includes("category=ai-systems")),
      ).toBe(true),
    );
  });

  it("filters by type and language selects", async () => {
    await setLang("zh");
    const user = userEvent.setup();
    const { fetchMock, sidebar } = setup();
    await waitFor(() => expect(sidebar().getByText("技术")).toBeInTheDocument());
    const selects = screen.getAllByRole("combobox");
    await user.selectOptions(selects[0], "video");
    await user.selectOptions(selects[1], "en");
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some((c) => String(c[0]).includes("content_type=video")),
      ).toBe(true),
    );
    await waitFor(() =>
      expect(fetchMock.mock.calls.some((c) => String(c[0]).includes("lang=en"))).toBe(true),
    );
  });

  it("toggles a tag filter", async () => {
    await setLang("zh");
    const user = userEvent.setup();
    const { fetchMock, sidebar } = setup();
    await waitFor(() => expect(sidebar().getByText("#大模型")).toBeInTheDocument());
    await user.click(sidebar().getByText("#大模型"));
    await waitFor(() =>
      expect(fetchMock.mock.calls.some((c) => String(c[0]).includes("tag=llm"))).toBe(true),
    );
  });

  it("clears filters via the All button and topic toggle", async () => {
    await setLang("zh");
    const user = userEvent.setup();
    const { fetchMock, sidebar } = setup();
    await waitFor(() => expect(sidebar().getByText("技术")).toBeInTheDocument());
    // turn a topic on then off (covers the delete branch of setFilter)
    await user.click(sidebar().getByText("AI 基础设施"));
    await waitFor(() =>
      expect(fetchMock.mock.calls.some((c) => String(c[0]).includes("topic=ai-infra"))).toBe(
        true,
      ),
    );
    await user.click(sidebar().getByText("AI 基础设施"));
    await user.click(sidebar().getByText("全部"));
    await waitFor(() => expect(sidebar().getByText("技术")).toBeInTheDocument());
  });

  it("searches by keyword and paginates", async () => {
    await setLang("zh");
    const user = userEvent.setup();
    const fetchMock = mockFetch({
      "/taxonomy/categories": [rootCategory, category],
      "/taxonomy/tags": [tag],
      "/taxonomy/topics": [topic],
      "/contents": page([card], 30),
    });
    renderApp(<Browse />, { route: "/browse" });
    await waitFor(() => expect(screen.getByText("测试内容标题")).toBeInTheDocument());
    await user.type(screen.getByPlaceholderText(/搜索关键词/), "推理{Enter}");
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some((c) => decodeURIComponent(String(c[0])).includes("q=推理")),
      ).toBe(true),
    );
    await user.click(screen.getByText("→"));
    await waitFor(() =>
      expect(fetchMock.mock.calls.some((c) => String(c[0]).includes("page=2"))).toBe(true),
    );
  });

  it("shows empty state when no content", async () => {
    await setLang("zh");
    setup([]);
    await waitFor(() => expect(screen.getByText(/暂无内容/)).toBeInTheDocument());
  });
});
