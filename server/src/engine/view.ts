import { SessionState } from "./state.js";
import { TOPICS, getTopic } from "../itemBank/index.js";
import { BLOOM_ORDER, CPA_ORDER, cellId } from "../types.js";

export interface GridCellView {
  cpa: string;
  bloom: string;
  status: "cleared" | "current" | "back-probe" | "untested";
}

export function buildGrid(topicId: string, state: SessionState): GridCellView[] {
  const t = state.topics[topicId];
  const cells: GridCellView[] = [];
  for (const cpa of CPA_ORDER) {
    for (const bloom of BLOOM_ORDER) {
      const key = cellId({ cpa, bloom });
      const isCurrent = t.probeCpa === cpa && t.probeBloom === bloom;
      let status: GridCellView["status"] = "untested";
      if (t.cellStatus[key] === "cleared") status = "cleared";
      else if (t.cellStatus[key] === "struggled") status = "back-probe";
      if (isCurrent) status = "current";
      cells.push({ cpa, bloom, status });
    }
  }
  return cells;
}

export interface SessionMapEntry {
  topicId: string;
  name: string;
  status: string;
}

export function buildSessionMap(state: SessionState): SessionMapEntry[] {
  return TOPICS.map((topic) => {
    const t = state.topics[topic.id];
    let status = "locked";
    if (t.status === "mastered") status = "cleared";
    else if (t.status === "in_progress") status = "in progress";
    else if (t.status === "lag_point") status = "revisit later";
    return { topicId: topic.id, name: topic.name, status };
  });
}

export function buildBreadcrumb(topicId: string | null, state: SessionState): string {
  if (!topicId) return "Warm-up";
  const topic = getTopic(topicId);
  const t = state.topics[topicId];
  const probing = t.consecutiveStruggle > 0 ? "Probing sub-skill" : "Assessing";
  return `${topic.strand} → ${topic.name} → ${probing}`;
}
