import { FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../api";

export default function ReportModal({
  contentId,
  onClose,
}: {
  contentId: number;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [reason, setReason] = useState("");
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await api("/admin/takedowns", {
        method: "POST",
        body: { content_id: contentId, reason, requester_email: email },
      });
      setDone(true);
    } catch (err) {
      setError(String((err as Error).message));
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>{t("report.title")}</h3>
        {done ? (
          <>
            <p className="ok-msg">{t("report.done")}</p>
            <div className="modal-actions">
              <button className="primary" onClick={onClose}>{t("pay.cancel")}</button>
            </div>
          </>
        ) : (
          <form className="form" onSubmit={submit}>
            <label>
              {t("report.reason")}
              <textarea value={reason} onChange={(e) => setReason(e.target.value)} required minLength={4} />
            </label>
            <label>
              {t("report.email")}
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            {error && <p className="error-msg">{error}</p>}
            <div className="modal-actions">
              <button type="button" onClick={onClose}>{t("pay.cancel")}</button>
              <button className="primary" type="submit">{t("report.submit")}</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
