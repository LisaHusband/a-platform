import DOMPurify from "dompurify";
import { marked } from "marked";
import { useMemo } from "react";

export default function Markdown({ source }: { source: string }) {
  const html = useMemo(
    () => DOMPurify.sanitize(marked.parse(source, { async: false })),
    [source],
  );
  return <div className="prose" dangerouslySetInnerHTML={{ __html: html }} />;
}
