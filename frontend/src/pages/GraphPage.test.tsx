import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { graph, topic } from "../test/fixtures";
import { mockFetch, renderApp, setLang } from "../test/utils";
import GraphPage from "./GraphPage";

function Harness() {
  return (
    <Routes>
      <Route path="/graph" element={<GraphPage />} />
      <Route path="/content/:id" element={<div>内容详情页</div>} />
    </Routes>
  );
}

describe("GraphPage", () => {
  it("renders nodes and edges", async () => {
    await setLang("zh");
    mockFetch({ "/taxonomy/topics": [topic], "/contents/graph": graph });
    renderApp(<Harness />, { route: "/graph" });
    await waitFor(() => expect(screen.getByText("节点一")).toBeInTheDocument());
    expect(screen.getByText("节点二")).toBeInTheDocument();
    expect(screen.getByText("related")).toBeInTheDocument();
  });

  it("navigates to content when a node is clicked", async () => {
    await setLang("zh");
    const user = userEvent.setup();
    mockFetch({ "/taxonomy/topics": [topic], "/contents/graph": graph });
    renderApp(<Harness />, { route: "/graph" });
    await waitFor(() => expect(screen.getByText("节点一")).toBeInTheDocument());
    await user.click(screen.getByText("节点一"));
    await waitFor(() => expect(screen.getByText("内容详情页")).toBeInTheDocument());
  });

  it("filters by topic", async () => {
    await setLang("zh");
    const user = userEvent.setup();
    const fetchMock = mockFetch({ "/taxonomy/topics": [topic], "/contents/graph": graph });
    renderApp(<Harness />, { route: "/graph" });
    await waitFor(() => expect(screen.getByText("节点一")).toBeInTheDocument());
    await user.selectOptions(screen.getByRole("combobox"), "ai-infra");
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some((c) => String(c[0]).includes("topic=ai-infra")),
      ).toBe(true),
    );
  });

  it("clears the topic filter back to none", async () => {
    await setLang("zh");
    const user = userEvent.setup();
    const fetchMock = mockFetch({ "/taxonomy/topics": [topic], "/contents/graph": graph });
    renderApp(<Harness />, { route: "/graph?topic=ai-infra" });
    await waitFor(() => expect(screen.getByText("节点一")).toBeInTheDocument());
    await user.selectOptions(screen.getByRole("combobox"), "");
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(
          (c) => String(c[0]).includes("/contents/graph") && !String(c[0]).includes("topic="),
        ),
      ).toBe(true),
    );
  });

  it("shows an error on failure", async () => {
    await setLang("zh");
    mockFetch({ "/taxonomy/topics": [topic], "/contents/graph": new Error("图谱失败") });
    renderApp(<Harness />, { route: "/graph" });
    await waitFor(() => expect(screen.getByText(/图谱失败/)).toBeInTheDocument());
  });
});
