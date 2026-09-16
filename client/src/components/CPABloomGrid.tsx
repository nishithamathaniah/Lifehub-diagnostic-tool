import { GridCellView } from "../types";

const CPA_ROWS: { key: string; label: string }[] = [
  { key: "abstract", label: "Abstract" },
  { key: "pictorial", label: "Pictorial" },
  { key: "concrete", label: "Concrete" },
];
const BLOOM_COLS: { key: string; label: string }[] = [
  { key: "remember", label: "Remem." },
  { key: "understand", label: "Underst." },
  { key: "apply", label: "Apply" },
  { key: "analyze", label: "Analyze" },
  { key: "evaluate", label: "Eval." },
];

export function CPABloomGrid({ cells, topicLabel }: { cells: GridCellView[]; topicLabel: string }) {
  const find = (cpa: string, bloom: string) => cells.find((c) => c.cpa === cpa && c.bloom === bloom);

  return (
    <div className="panel-section">
      <div className="panel-title">Topic depth — {topicLabel}</div>
      <table className="grid-table">
        <thead>
          <tr>
            <th></th>
            {BLOOM_COLS.map((b) => (
              <th key={b.key}>{b.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {CPA_ROWS.map((row) => (
            <tr key={row.key}>
              <td className="row-label">{row.label}</td>
              {BLOOM_COLS.map((b) => {
                const cell = find(row.key, b.key);
                return (
                  <td key={b.key}>
                    <div className={`grid-cell ${cell?.status ?? "untested"}`} title={`${row.label} · ${b.label}`} />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="grid-legend">
        <span><span className="dot" style={{ background: "var(--deep-teal)" }} />Cleared</span>
        <span><span className="dot" style={{ background: "var(--warm-amber)" }} />Current</span>
        <span><span className="dot" style={{ background: "var(--tan)" }} />Back-probe</span>
        <span><span className="dot" style={{ background: "#efe9db" }} />Not yet tested</span>
      </div>
    </div>
  );
}
