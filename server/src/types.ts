export type CPAStage = "concrete" | "pictorial" | "abstract";
export type BloomLevel = "remember" | "understand" | "apply" | "analyze" | "evaluate";

export const BLOOM_ORDER: BloomLevel[] = ["remember", "understand", "apply", "analyze", "evaluate"];
export const CPA_ORDER: CPAStage[] = ["concrete", "pictorial", "abstract"];
export const BLOOM_CEILING: BloomLevel = "analyze";
export const ENTRY_CPA: CPAStage = "pictorial";
export const ENTRY_BLOOM: BloomLevel = "understand";

export interface BarModelSpec {
  kind: "bar-model";
  totalLabel: string;
  parts: number;
  highlightParts?: number;
  queryPartIndex?: number;
  segmentLabels?: string[];
  /**
   * For questions that combine two separate portions of the same whole
   * (e.g. "Raj eats 2/6, Mia eats 1/6 — how much together?"). Each entry
   * gets its own highlight color, in order, filling from the start of the
   * bar; any parts left over after all groups are unshaded. Takes priority
   * over highlightParts when present, since a single undifferentiated
   * highlight can't show two people's shares separately.
   */
  highlightGroups?: { count: number; label: string }[];
}

export interface ConcreteSpec {
  kind: "concrete";
  icon: string;
  itemCount: number;
  groups: number;
  groupLabel: string;
  /**
   * For questions describing a mixed collection (e.g. "3/8 red, 2/8 blue
   * marbles in one bag") where a single repeated icon can't show the
   * different subsets. Takes priority over icon/itemCount/groups when
   * present.
   */
  segments?: { icon: string; count: number; label: string }[];
}

export type Representation = BarModelSpec | ConcreteSpec | null;

export interface Choice {
  id: string;
  text: string;
}

export interface Item {
  id: string;
  topicId: string;
  cpa: CPAStage;
  bloom: BloomLevel;
  subskill: string;
  prompt: string;
  representation: Representation;
  choices: Choice[];
  correctChoiceId: string;
}

export interface Topic {
  id: string;
  strand: string;
  name: string;
  shortLabel: string;
  dependsOn: string[];
}

export type DiagnosisTag = "mastered" | "skill_gap" | "procedural_not_conceptual" | "anxiety_flagged" | "not_yet_reached";

export interface CellKey {
  cpa: CPAStage;
  bloom: BloomLevel;
}

export function cellId(cell: CellKey): string {
  return `${cell.cpa}:${cell.bloom}`;
}
