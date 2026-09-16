import { ConcreteSpec } from "../types";

export function ConcreteObjects({ spec }: { spec: ConcreteSpec }) {
  const perGroup = Math.floor(spec.itemCount / spec.groups);
  const remainder = spec.itemCount % spec.groups;
  const groups = Array.from({ length: spec.groups }, (_, i) => perGroup + (i < remainder ? 1 : 0));

  return (
    <div className="concrete-wrap">
      <div className="concrete-groups">
        {groups.map((count, i) => (
          <div className="concrete-group" key={i}>
            <div className="icons">{spec.icon.repeat(count)}</div>
            <div className="glabel">
              {spec.groupLabel} {spec.groups > 1 ? i + 1 : ""}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
