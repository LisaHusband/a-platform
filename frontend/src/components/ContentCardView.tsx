import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { ContentCard } from "../api";
import { useLocalName } from "../context";

export default function ContentCardView({
  content,
  children,
}: {
  content: ContentCard;
  children?: React.ReactNode;
}) {
  const { t, i18n } = useTranslation();
  const name = useLocalName();
  const date = content.published_at
    ? new Date(content.published_at).toLocaleDateString(
        i18n.language.startsWith("zh") ? "zh-CN" : "en-US",
      )
    : "";

  return (
    <div className="card">
      <h3>
        <Link to={`/content/${content.id}`}>{content.title}</Link>
      </h3>
      <div className="meta">
        <span className="chip type">{t(`browse.types.${content.content_type}`)}</span>
        {content.category && (
          <Link to={`/browse?category=${content.category.slug}`} className="chip">
            {name(content.category)}
          </Link>
        )}
        {content.author && <span>{t("content.by")} {content.author.name}</span>}
        <span>{date}</span>
        <span>{t("content.minutes", { n: content.reading_minutes })}</span>
        <span className="price-tag">
          {content.price > 0 ? `$${content.price}` : t("content.free")}
        </span>
      </div>
      {content.abstract && <p className="snippet">{content.abstract}</p>}
      <div className="meta">
        {content.tags.map((tag) => (
          <Link key={tag.id} to={`/search?q=${encodeURIComponent(`tag:${tag.slug}`)}`} className="chip">
            #{name(tag)}
          </Link>
        ))}
        {content.topics.map((topic) => (
          <Link key={topic.id} to={`/browse?topic=${topic.slug}`} className="chip">
            {name(topic)}
          </Link>
        ))}
      </div>
      {children}
    </div>
  );
}
