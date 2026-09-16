import { SessionMapEntry } from "../types";

const STATUS_CLASS: Record<string, string> = {
  cleared: "cleared",
  "in progress": "in-progress",
  locked: "locked",
  "revisit later": "revisit",
};

export function SessionMap({ entries }: { entries: SessionMapEntry[] }) {
  return (
    <div className="panel-section">
      <div className="panel-title">Session map</div>
      {entries.map((e) => (
        <div className="map-item" key={e.topicId}>
          <span>{e.name}</span>
          <span className={`map-status ${STATUS_CLASS[e.status] ?? "locked"}`}>{e.status}</span>
        </div>
      ))}
    </div>
  );
}
