export function EngineTrace({ lines }: { lines: string[] }) {
  return (
    <div className="panel-section">
      <div className="panel-title">Engine trace</div>
      {lines.length === 0 && <div className="trace-line">Warming up…</div>}
      {lines.map((line, i) => (
        <div className="trace-line" key={i}>
          {line}
        </div>
      ))}
    </div>
  );
}
