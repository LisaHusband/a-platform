import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Routes, Route } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { mockFetch, renderApp } from "../test/utils";
import SearchBar from "./SearchBar";

function Harness() {
  return (
    <Routes>
      <Route path="/" element={<SearchBar />} />
      <Route path="/search" element={<div>搜索结果页 {location.search}</div>} />
    </Routes>
  );
}

describe("SearchBar", () => {
  it("submits a query and navigates to /search", async () => {
    const user = userEvent.setup();
    mockFetch({ "/search/suggest": [] });
    renderApp(<Harness />);
    await user.type(screen.getByRole("textbox"), "推理成本");
    await user.click(screen.getByRole("button"));
    await waitFor(() => expect(screen.getByText(/搜索结果页/)).toBeInTheDocument());
  });

  it("shows suggestions while typing and navigates on click", async () => {
    const user = userEvent.setup();
    mockFetch({ "/search/suggest": ["推理成本测算", "推理优化"] });
    renderApp(<Harness />);
    await user.type(screen.getByRole("textbox"), "推理");
    await waitFor(() => expect(screen.getByText("推理成本测算")).toBeInTheDocument());
    await user.click(screen.getByText("推理成本测算"));
    await waitFor(() => expect(screen.getByText(/搜索结果页/)).toBeInTheDocument());
  });

  it("does not navigate on empty submit", async () => {
    const user = userEvent.setup();
    mockFetch({ "/search/suggest": [] });
    renderApp(<Harness />);
    await user.click(screen.getByRole("button"));
    expect(screen.queryByText(/搜索结果页/)).not.toBeInTheDocument();
  });

  it("tolerates suggest endpoint failure", async () => {
    const user = userEvent.setup();
    const fetchMock = mockFetch({ "/search/suggest": new Error("boom") });
    renderApp(<Harness />);
    await user.type(screen.getByRole("textbox"), "fail");
    // wait for the debounced suggest call to fire and be caught (no crash)
    await waitFor(() =>
      expect(fetchMock.mock.calls.some((c) => String(c[0]).includes("/search/suggest"))).toBe(
        true,
      ),
    );
  });
});
