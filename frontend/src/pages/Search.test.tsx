import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { card, searchOut } from "../test/fixtures";
import { mockFetch, renderApp, setLang } from "../test/utils";
import Search from "./Search";

describe("Search page", () => {
  it("renders hits with snippet and explanation toggle", async () => {
    await setLang("zh");
    const user = userEvent.setup();
    mockFetch({ "/search": searchOut });
    renderApp(<Search />, { route: "/search?q=测试" });
    await waitFor(() => expect(screen.getByText("测试内容标题")).toBeInTheDocument());
    // explanation is inside a collapsed <details>; open it
    await user.click(screen.getByText(/为什么排在这里/));
    expect(screen.getByText(/bm25=8.50/)).toBeInTheDocument();
  });

  it("renders did-you-mean suggestion", async () => {
    await setLang("zh");
    mockFetch({ "/search": { ...searchOut, did_you_mean: "推理成本" } });
    renderApp(<Search />, { route: "/search?q=推理陈本" });
    await waitFor(() => expect(screen.getByText("推理成本")).toBeInTheDocument());
  });

  it("renders no-results message", async () => {
    await setLang("zh");
    mockFetch({ "/search": { ...searchOut, total: 0, hits: [] } });
    renderApp(<Search />, { route: "/search?q=空" });
    await waitFor(() =>
      expect(screen.getByText(/没有找到匹配内容/)).toBeInTheDocument(),
    );
  });

  it("changes sort order", async () => {
    await setLang("zh");
    const user = userEvent.setup();
    const fetchMock = mockFetch({ "/search": searchOut });
    renderApp(<Search />, { route: "/search?q=测试" });
    await waitFor(() => expect(screen.getByText("测试内容标题")).toBeInTheDocument());
    await user.selectOptions(screen.getByRole("combobox"), "newest");
    await waitFor(() =>
      expect(fetchMock.mock.calls.some((c) => String(c[0]).includes("sort=newest"))).toBe(
        true,
      ),
    );
  });

  it("paginates when there are multiple pages", async () => {
    await setLang("zh");
    const user = userEvent.setup();
    const many = { ...searchOut, total: 25, page_size: 10, hits: [searchOut.hits[0]] };
    const fetchMock = mockFetch({ "/search": many });
    renderApp(<Search />, { route: "/search?q=测试" });
    await waitFor(() => expect(screen.getByText(/1 \/ 3/)).toBeInTheDocument());
    await user.click(screen.getByText("→"));
    await waitFor(() =>
      expect(fetchMock.mock.calls.some((c) => String(c[0]).includes("page=2"))).toBe(true),
    );
  });

  it("shows an error on failure", async () => {
    await setLang("zh");
    mockFetch({ "/search": new Error("搜索失败") });
    renderApp(<Search />, { route: "/search?q=x" });
    await waitFor(() => expect(screen.getByText(/搜索失败/)).toBeInTheDocument());
  });

  it("does nothing without a query", async () => {
    await setLang("zh");
    mockFetch({ "/search": searchOut });
    renderApp(<Search />, { route: "/search" });
    expect(screen.queryByText(card.title)).not.toBeInTheDocument();
  });

  it("shows the operator help", async () => {
    await setLang("zh");
    mockFetch({ "/search": searchOut });
    renderApp(<Search />, { route: "/search?q=测试" });
    expect(screen.getByText(/搜索语法/)).toBeInTheDocument();
  });
});
