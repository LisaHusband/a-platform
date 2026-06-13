import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, ContentCard } from "../api";
import ContentCardView from "../components/ContentCardView";

export default function Home() {
  const { t } = useTranslation();
  const [latest, setLatest] = useState<ContentCard[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    api<ContentCard[]>("/contents?sort=newest&page_size=6")
      .then(setLatest)
      .catch((e) => setError(String(e.message)));
  }, []);

  return (
    <div className="page container">
      <section className="hero">
        <h1>{t("home.heroTitle")}</h1>
        <p>{t("home.heroSub")}</p>
      </section>
      <section className="principles">
        {(["p1", "p2", "p3", "p4"] as const).map((k) => (
          <div className="card" key={k}>
            {t(`home.${k}`)}
          </div>
        ))}
      </section>
      <h2>{t("home.latest")}</h2>
      {error && <p className="error-msg">{t("common.error")}{error}</p>}
      {latest.map((c) => (
        <ContentCardView key={c.id} content={c} />
      ))}
    </div>
  );
}
