import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { mockFetch, renderApp, setLang } from "../test/utils";
import ReportModal from "./ReportModal";

describe("ReportModal", () => {
  it("surfaces an error when the request fails", async () => {
    await setLang("zh");
    const user = userEvent.setup();
    mockFetch({ "POST /admin/takedowns": new Error("提交失败") });
    renderApp(<ReportModal contentId={1} onClose={vi.fn()} />);
    await user.type(screen.getByLabelText(/请说明原因/), "测试原因");
    await user.click(screen.getByRole("button", { name: "提交请求" }));
    await waitFor(() => expect(screen.getByText("提交失败")).toBeInTheDocument());
  });

  it("closes via cancel", async () => {
    await setLang("zh");
    const user = userEvent.setup();
    const onClose = vi.fn();
    mockFetch({});
    renderApp(<ReportModal contentId={1} onClose={onClose} />);
    await user.click(screen.getByRole("button", { name: /取消/ }));
    expect(onClose).toHaveBeenCalled();
  });
});
