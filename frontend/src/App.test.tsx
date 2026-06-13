import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "./App";
import { card } from "./test/fixtures";
import { mockFetch } from "./test/utils";

describe("App", () => {
  it("renders the header and home route", async () => {
    mockFetch({ "/contents": [card] });
    render(<App />);
    expect(screen.getByText("A-PLATFORM")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("测试内容标题")).toBeInTheDocument());
  });
});
