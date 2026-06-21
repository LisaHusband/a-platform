import { screen, waitFor } from "@testing-library/react";
import { Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { board } from "../test/fixtures";
import { mockFetch, renderApp, setLang } from "../test/utils";
import Community from "./Community";

function Harness() {
  return (
    <Routes>
      <Route path="/community" element={<Community />} />
      <Route path="/community/:slug" element={<div>板块页</div>} />
    </Routes>
  );
}

describe("Community", () => {
  it("lists boards", async () => {
    await setLang("zh");
    mockFetch({ "/community/boards": [board] });
    renderApp(<Harness />, { route: "/community" });
    await waitFor(() => expect(screen.getByText("AI 基础设施吧")).toBeInTheDocument());
    expect(screen.getByText(/讨论 AI 基础设施/)).toBeInTheDocument();
  });

  it("shows an error on failure", async () => {
    await setLang("zh");
    mockFetch({ "/community/boards": new Error("加载失败") });
    renderApp(<Harness />, { route: "/community" });
    await waitFor(() => expect(screen.getByText(/加载失败/)).toBeInTheDocument());
  });
});
