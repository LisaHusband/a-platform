import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { setToken } from "../api";
import { reader } from "../test/fixtures";
import { mockFetch, renderApp, setLang } from "../test/utils";
import PaymentModal from "./PaymentModal";

function open(amount = 12, onSuccess = vi.fn()) {
  return renderApp(
    <PaymentModal
      kind="content"
      refId="1"
      title="测试内容"
      amount={amount}
      onClose={vi.fn()}
      onSuccess={onSuccess}
    />,
  );
}

describe("PaymentModal", () => {
  it("pays with wallet balance and calls onSuccess", async () => {
    await setLang("zh");
    setToken("tok");
    const user = userEvent.setup();
    const onSuccess = vi.fn();
    mockFetch({
      "/auth/me": reader,
      "POST /payments": { order: { id: 1, status: "paid", method: "balance" } },
    });
    open(12, onSuccess);
    await waitFor(() => expect(screen.getByText(/选择支付方式/)).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: /立即支付/ }));
    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
  });

  it("blocks balance payment when funds are insufficient", async () => {
    await setLang("zh");
    setToken("tok");
    const user = userEvent.setup();
    mockFetch({ "/auth/me": { ...reader, balance: 5 } });
    open(12);
    await waitFor(() => expect(screen.getByText(/\(¥5\)/)).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: /立即支付/ }));
    await waitFor(() => expect(screen.getByText(/余额不足/)).toBeInTheDocument());
  });

  it("runs the paypal redirect + confirm flow", async () => {
    await setLang("zh");
    setToken("tok");
    const user = userEvent.setup();
    const onSuccess = vi.fn();
    mockFetch({
      "/auth/me": reader,
      "POST /payments/1/confirm": { status: "paid" },
      "POST /payments": {
        order: { id: 1, status: "created", method: "paypal" },
        approval_url: "https://sandbox.paypal.example/x",
        qr_code: null,
      },
    });
    open(30, onSuccess);
    await waitFor(() => expect(screen.getByText(/选择支付方式/)).toBeInTheDocument());
    await user.click(screen.getByText(/PayPal/));
    await user.click(screen.getByRole("button", { name: /立即支付/ }));
    await waitFor(() => expect(screen.getByText(/前往收银台/)).toBeInTheDocument());
    await user.click(screen.getByText(/前往收银台/)); // provider redirect link
    await user.click(screen.getByRole("button", { name: /我已完成支付/ }));
    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
  });

  it("shows an error when order creation fails", async () => {
    await setLang("zh");
    setToken("tok");
    const user = userEvent.setup();
    mockFetch({ "/auth/me": reader, "POST /payments": new Error("下单失败") });
    open(12);
    await waitFor(() => expect(screen.getByText(/选择支付方式/)).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: /立即支付/ }));
    await waitFor(() => expect(screen.getByText("下单失败")).toBeInTheDocument());
  });

  it("closes when the backdrop is clicked", async () => {
    await setLang("zh");
    setToken("tok");
    const user = userEvent.setup();
    const onClose = vi.fn();
    mockFetch({ "/auth/me": reader });
    renderApp(
      <PaymentModal
        kind="content"
        refId="1"
        title="x"
        amount={1}
        onClose={onClose}
        onSuccess={vi.fn()}
      />,
    );
    await waitFor(() => expect(screen.getByText(/选择支付方式/)).toBeInTheDocument());
    await user.click(document.querySelector(".modal-overlay")!);
    expect(onClose).toHaveBeenCalled();
  });

  it("shows failure when the sandbox callback fails", async () => {
    await setLang("zh");
    setToken("tok");
    const user = userEvent.setup();
    mockFetch({
      "/auth/me": reader,
      "POST /payments/1/confirm": { status: "failed" },
      "POST /payments": {
        order: { id: 1, status: "created", method: "alipay" },
        approval_url: "https://sandbox.alipay.example/x",
        qr_code: "https://sandbox.alipay.example/x",
      },
    });
    open(12);
    await waitFor(() => expect(screen.getByText(/选择支付方式/)).toBeInTheDocument());
    await user.click(screen.getByText(/支付宝（沙箱）/));
    await user.click(screen.getByRole("button", { name: /立即支付/ }));
    await waitFor(() => expect(screen.getByText(/支付宝扫码/)).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: /模拟支付失败/ }));
    await waitFor(() => expect(screen.getByText(/支付失败或已取消/)).toBeInTheDocument());
  });
});
