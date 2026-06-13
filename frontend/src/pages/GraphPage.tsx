import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api, GraphOut, Topic } from "../api";
import { useLocalName } from "../context";

const W = 960;
const H = 560;

export default function GraphPage() {
  const { t } = useTranslation();
  const name = useLocalName();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const topic = params.get("topic") ?? "";
  const [graph, setGraph] = useState<GraphOut | null>(null);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    api<Topic[]>("/taxonomy/topics").then(setTopics).catch(() => {});
  }, []);

  useEffect(() => {
    const qs = topic ? `?topic=${encodeURIComponent(topic)}` : "";
    api<GraphOut>(`/contents/graph${qs}`)
      .then(setGraph)
      .catch((e) => setError(String(e.message)));
  }, [topic]);

  const layout = useMemo(() => {
    if (!graph) return new Map<number, { x: number; y: number }>();
    const n = graph.nodes.length || 1;
    const cx = W / 2;
    const cy = H / 2;
    const r = Math.min(W, H) / 2 - 80;
    return new Map(
      graph.nodes.map((node, i) => [
        node.id,
        {
          x: cx + r * Math.cos((2 * Math.PI * i) / n - Math.PI / 2),
          y: cy + r * Math.sin((2 * Math.PI * i) / n - Math.PI / 2),
        },
      ]),
    );
  }, [graph]);

  return (
    <div className="page container">
      <h1>{t("graph.title")}</h1>
      <p className="meta">{t("graph.hint")}</p>
      <div className="toolbar">
        <label>
          {t("graph.filterTopic")}{" "}
          <select
            value={topic}
            onChange={(e) => {
              const next = new URLSearchParams(params);
              if (e.target.value) next.set("topic", e.target.value);
              else next.delete("topic");
              setParams(next);
            }}
          >
            <option value="">—</option>
            {topics.map((tp) => (
              <option key={tp.id} value={tp.slug}>
                {name(tp)}
              </option>
            ))}
          </select>
        </label>
      </div>
      {error && <p className="error-msg">{t("common.error")}{error}</p>}
      {graph && (
        <svg className="graph-svg" viewBox={`0 0 ${W} ${H}`}>
          {graph.edges.map((e, i) => {
            const a = layout.get(e.src);
            const b = layout.get(e.dst);
            if (!a || !b) return null;
            return (
              <g key={i}>
                <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
                <text className="edge-label" x={(a.x + b.x) / 2} y={(a.y + b.y) / 2}>
                  {e.relation}
                </text>
              </g>
            );
          })}
          {graph.nodes.map((node) => {
            const p = layout.get(node.id)!;
            return (
              <g key={node.id} onClick={() => navigate(`/content/${node.id}`)}>
                <circle cx={p.x} cy={p.y} r={9} />
                <text x={p.x + 13} y={p.y + 4}>
                  {node.title.length > 26 ? `${node.title.slice(0, 26)}…` : node.title}
                </text>
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
}
