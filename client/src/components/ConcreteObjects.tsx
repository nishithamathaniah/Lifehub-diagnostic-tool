import { ConcreteSpec } from "../types";

export function ConcreteObjects({ spec }: { spec: ConcreteSpec }) {
  if (spec.segments?.length) {
    // A mixed collection (e.g. "3/8 red, 2/8 blue" marbles in one bag) —
    // each subset gets its own icon so the proportions are actually visible,
    // instead of repeating a single icon that can't show the difference.
    return (
      <div className="concrete-wrap">
        <div className="concrete-mixed">
          {spec.segments.map((seg, i) => (
            <span key={i} className="mixed-icons">
              {seg.icon.repeat(seg.count)}
            </span>
          ))}
        </div>
        <div className="concrete-mixed-legend">
          {spec.segments.map((seg, i) => (
            <span key={i} className="mixed-legend-item">
              {seg.icon} {seg.label} ({seg.count})
            </span>
          ))}
        </div>
      </div>
    );
  }

  const perGroup = Math.floor(spec.itemCount / spec.groups);
  const remainder = spec.itemCount % spec.groups;

  return (
    <div className="concrete-wrap">
      <div className="concrete-groups">
        {Array.from({ length: spec.groups }, (_, i) => (
          <div className="concrete-group" key={i}>
            {/* Every group gets the same whole-number share — a remainder is
                never assigned to one group over another, or it would visually
                contradict a prompt that says the items were shared equally. */}
            <div className="icons">{spec.icon.repeat(perGroup)}</div>
            <div className="glabel">
              {spec.groupLabel} {spec.groups > 1 ? i + 1 : ""}
            </div>
          </div>
        ))}
      </div>
      {remainder > 0 && (
        <div className="concrete-remainder">
          <div className="icons">{spec.icon.repeat(remainder)}</div>
          <div className="glabel">left over — not yet split</div>
        </div>
      )}
    </div>
  );
}
