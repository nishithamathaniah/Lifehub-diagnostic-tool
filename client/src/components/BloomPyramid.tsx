import { BloomLevel } from "../types";

const LEVELS: BloomLevel[] = ["evaluate", "analyze", "apply", "understand", "remember"];
const WIDTH: Record<BloomLevel, string> = {
  evaluate: "40%",
  analyze: "55%",
  apply: "70%",
  understand: "85%",
  remember: "100%",
};

export function BloomPyramid({
  strand,
  sub,
  assessed,
  deepest,
}: {
  strand: string;
  sub: string;
  assessed: boolean;
  deepest: BloomLevel | null;
}) {
  const deepestIdx = deepest ? LEVELS.indexOf(deepest) : -1; // index within LEVELS (evaluate=0..remember=4)
  return (
    <div className="pyramid-card">
      <h4>{strand}</h4>
      <div className="pyr-sub">{assessed ? sub : "Not yet assessed in this pilot"}</div>
      {LEVELS.map((level, i) => {
        const filled = assessed && deepestIdx >= 0 && i >= deepestIdx;
        return (
          <div className="pyr-level" key={level}>
            <span className="pyr-label">{level}</span>
            <div style={{ width: WIDTH[level] }}>
              <div className={`pyr-bar ${filled ? "filled" : ""}`} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
