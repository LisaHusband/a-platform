import { useState } from "react";
import { useTranslation } from "react-i18next";
import { api, PaymentCreateOut, PaymentMethod } from "../api";
import { useApp } from "../context";

interface Props {
  kind: "content" | "subscription";
  refId: string; // content id, or "monthly" / "topic:<slug>"
  title: string;
  amount: number;
  onClose: () => void;
  onSuccess: () => void;
}

const METHODS: PaymentMethod[] = ["balance", "alipay", "paypal"];

export default function PaymentModal({ kind, refId, title, amount, onClose, onSuccess }: Props) {
  const { t } = useTranslation();
  const { user, refreshUser } = useApp();
  const [method, setMethod] = useState<PaymentMethod>("balance");
  const [stage, setStage] = useState<"choose" | "redirect" | "processing">("choose");
  const [created, setCreated] = useState<PaymentCreateOut | null>(null);
  const [error, setError] = useState("");

  async function pay() {
    setError("");
    if (method === "balance" && user && user.balance < amount) {
      setError(t("pay.insufficient"));
      return;
    }
    setStage("processing");
    try {
      const res = await api<PaymentCreateOut>("/payments", {
        method: "POST",
        body: { kind, ref: refId, method },
      });
      if (res.order.status === "paid") {
        refreshUser();
        onSuccess();
        return;
      }
      setCreated(res);
      setStage("redirect");
    } catch (e) {
      setError(String((e as Error).message));
      setStage("choose");
    }
  }

  async function confirm(outcome: "success" | "fail") {
    if (!created) return;
    setStage("processing");
    setError("");
    try {
      const order = await api<{ status: string }>(
        `/payments/${created.order.id}/confirm?outcome=${outcome}`,
        { method: "POST" },
      );
      if (order.status === "paid") {
        refreshUser();
        onSuccess();
      } else {
        setError(t("pay.failed"));
        setStage("redirect");
      }
    } catch (e) {
      setError(String((e as Error).message));
      setStage("redirect");
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal pay-modal" onClick={(e) => e.stopPropagation()}>
        <h3>{t("pay.title")}</h3>
        <p className="meta">
          {title} · <strong className="price-tag">¥{amount}</strong>
        </p>

        {stage !== "redirect" && (
          <>
            <div className="pay-methods">
              {METHODS.map((m) => (
                <button
                  key={m}
                  className={`pay-method ${method === m ? "active" : ""}`}
                  onClick={() => setMethod(m)}
                  disabled={stage === "processing"}
                >
                  <span className="pay-icon">
                    {m === "balance" ? "💰" : m === "alipay" ? "🅰️" : "🅿️"}
                  </span>
                  {t(`pay.${m}`)}
                  {m === "balance" && user && (
                    <span className="meta"> (¥{user.balance.toFixed(0)})</span>
                  )}
                </button>
              ))}
            </div>
            {error && <p className="error-msg">{error}</p>}
            <div className="modal-actions">
              <button onClick={onClose}>{t("pay.cancel")}</button>
              <button className="primary" onClick={pay} disabled={stage === "processing"}>
                {stage === "processing" ? t("pay.processing") : t("pay.pay")}
              </button>
            </div>
          </>
        )}

        {stage === "redirect" && created && (
          <div className="pay-redirect">
            <p className="meta">{t("pay.sandboxNotice")}</p>
            {created.qr_code ? (
              <div className="qr-box" aria-label={t("pay.scanQr")}>
                <div className="qr-fake">QR</div>
                <span className="meta">{t("pay.scanQr")}</span>
              </div>
            ) : (
              <a className="provider-link" href={created.approval_url ?? "#"} onClick={(e) => e.preventDefault()}>
                {t("pay.gotoProvider")} ↗
              </a>
            )}
            {error && <p className="error-msg">{error}</p>}
            <div className="modal-actions">
              <button onClick={() => confirm("fail")}>{t("pay.fail")}</button>
              <button className="primary" onClick={() => confirm("success")}>
                {t("pay.confirm")}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
