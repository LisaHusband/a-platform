import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Markdown from "./Markdown";

describe("Markdown", () => {
  it("renders markdown to HTML", () => {
    render(<Markdown source={"# 标题\n\n正文段落"} />);
    expect(screen.getByRole("heading", { name: "标题" })).toBeInTheDocument();
    expect(screen.getByText("正文段落")).toBeInTheDocument();
  });

  it("sanitizes dangerous markup", () => {
    const { container } = render(
      <Markdown source={'正常内容 <img src=x onerror="alert(1)">'} />,
    );
    expect(container.querySelector("img")?.getAttribute("onerror")).toBeNull();
  });
});
