import { BarModelSpec } from "../types";

export function BarModel({ spec }: { spec: BarModelSpec }) {
  const segments = Array.from({ length: spec.parts }, (_, i) => i);
  const highlighted = spec.highlightParts ?? spec.parts;

  return (
    <div className="bar-model">
      <div className="bar-total-label">{spec.totalLabel}</div>
      <div className="bar-track">
        {segments.map((i) => {
          const label = spec.segmentLabels?.[i] ?? `1/${spec.parts}`;
          const isQuery = spec.queryPartIndex === i;
          const isShaded = i < highlighted;
          return (
            <div
              key={i}
              className={`bar-seg ${isQuery ? "query" : !isShaded ? "unshaded" : ""}`}
            >
              {isQuery ? "?" : label}
            </div>
          );
        })}
      </div>
    </div>
  );
}
