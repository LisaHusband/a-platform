import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { card, freeCard } from "../test/fixtures";
import { mockFetch, renderApp, setLang } from "../test/utils";
import ContentCardView from "./ContentCardView";

describe("ContentCardView", () => {
  it("renders title, author, tags, topics and price", async () => {
    await setLang("zh");
    mockFetch({});
    renderApp(<ContentCardView content={card} />);
    expect(screen.getByText("测试内容标题")).toBeInTheDocument();
    expect(screen.getByText(/研究员/)).toBeInTheDocument();
    expect(screen.getByText(/#大模型/)).toBeInTheDocument();
    expect(screen.getByText("AI 基础设施")).toBeInTheDocument();
    expect(screen.getByText("$12")).toBeInTheDocument();
  });

  it("shows free label when price is 0 and renders children", async () => {
    await setLang("zh");
    mockFetch({});
    renderApp(
      <ContentCardView content={freeCard}>
        <span>额外子节点</span>
      </ContentCardView>,
    );
    expect(screen.getByText("免费")).toBeInTheDocument();
    expect(screen.getByText("额外子节点")).toBeInTheDocument();
  });

  it("renders without a publish date", async () => {
    await setLang("zh");
    mockFetch({});
    renderApp(<ContentCardView content={{ ...card, published_at: null }} />);
    expect(screen.getByText("测试内容标题")).toBeInTheDocument();
  });

  it("uses English names under en locale", async () => {
    await setLang("en");
    mockFetch({});
    renderApp(<ContentCardView content={card} />);
    expect(screen.getByText("AI Infrastructure")).toBeInTheDocument();
    await setLang("zh");
  });
});
