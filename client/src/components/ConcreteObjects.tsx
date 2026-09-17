import { ConcreteSpec } from "../types";

export function ConcreteObjects({ spec }: { spec: ConcreteSpec }) {
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
