import { BarModelSpec } from "../types";

const GROUP_CLASSES = ["group-a", "group-b", "group-c"];

export function BarModel({ spec }: { spec: BarModelSpec }) {
  const segments = Array.from({ length: spec.parts }, (_, i) => i);

  // groupOf[i] = index into spec.highlightGroups for segment i, or -1 if
  // it belongs to none of them (falls back to the plain highlightParts
  // behaviour when there are no groups at all).
  let groupOf: number[] = [];
  if (spec.highlightGroups?.length) {
    let cursor = 0;
    groupOf = segments.map(() => -1);
    spec.highlightGroups.forEach((g, gi) => {
      for (let k = 0; k < g.count && cursor < spec.parts; k++, cursor++) {
        groupOf[cursor] = gi;
      }
    });
  } else {
    const highlighted = spec.highlightParts ?? spec.parts;
    groupOf = segments.map((i) => (i < highlighted ? 0 : -1));
  }

  return (
    <div className="bar-model">
      <div className="bar-total-label">{spec.totalLabel}</div>
      <div className="bar-track">
        {segments.map((i) => {
          const label = spec.segmentLabels?.[i] ?? `1/${spec.parts}`;
          const isQuery = spec.queryPartIndex === i;
          const gi = groupOf[i];
          const groupClass = gi >= 0 ? GROUP_CLASSES[gi % GROUP_CLASSES.length] : "unshaded";
          return (
            <div key={i} className={`bar-seg ${isQuery ? "query" : groupClass}`}>
              {isQuery ? "?" : label}
            </div>
          );
        })}
      </div>
      {spec.highlightGroups && spec.highlightGroups.length > 0 && (
        <div className="bar-legend">
          {spec.highlightGroups.map((g, gi) => (
            <span key={gi} className="bar-legend-item">
              <span className={`bar-legend-swatch ${GROUP_CLASSES[gi % GROUP_CLASSES.length]}`} />
              {g.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
