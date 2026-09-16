import { BloomLevel, CPAStage, ENTRY_BLOOM, ENTRY_CPA } from "../types.js";
import { TOPICS } from "../itemBank/topics.js";
import type { ClientItem } from "../itemBank/index.js";

export type TopicStatus = "locked" | "in_progress" | "mastered" | "lag_point";

export interface PendingReframe {
  itemId: string;
  cpa: CPAStage;
  bloom: BloomLevel;
  subskill: string;
  originalSeq: number;
  scheduledAtSeq: number; // don't present before this sequence number
  presented: boolean;
}

export interface LagPoint {
  cpa: CPAStage;
  bloom: BloomLevel;
  subskill: string;
  reason: string;
}

export interface ProceduralCheck {
  itemId: string;
  subskill: string;
  scheduledAtSeq: number;
  presented: boolean;
  correct: boolean | null;
}

export interface TopicEngineState {
  status: TopicStatus;
  /** The forward-most cell the child must actually clear to progress — only moves on a genuine frontier clear. */
  frontierCpa: CPAStage;
  frontierBloom: BloomLevel;
  /** The cell currently being asked — equals the frontier, or sits below it during a drop/lateral-probe sequence. */
  probeCpa: CPAStage;
  probeBloom: BloomLevel;
  consecutiveStruggle: number;
  questionsAsked: number;
  askedItemIds: string[];
  lagPoints: LagPoint[];
  pendingReframes: PendingReframe[];
  reframeOutcome: "recovered" | "confirmed" | null;
  proceduralCheck: ProceduralCheck | null;
  masteredAtSeq: number | null;
  cellStatus: Record<string, "cleared" | "struggled">;
}

export interface PendingQuestion {
  seq: number;
  itemId: string;
  topicId: string;
  cpa: CPAStage;
  bloom: BloomLevel;
  isReframe: boolean;
  reframeOfSeq: number | null;
  isProceduralCheck: boolean;
  clientItem: ClientItem;
  shownAtServerMs: number;
}

export interface SessionState {
  topicOrder: string[];
  currentTopicIndex: number;
  topics: Record<string, TopicEngineState>;
  totalQuestions: number;
  seqCounter: number;
  engineTrace: string[];
  phase: "warmup" | "assessment" | "completed";
  warmupRemaining: number;
  maxQuestions: number;
  pendingQuestion: PendingQuestion | null;
}

export function createInitialState(): SessionState {
  const topicOrder = TOPICS.map((t) => t.id);
  const topics: Record<string, TopicEngineState> = {};
  topicOrder.forEach((id, idx) => {
    topics[id] = {
      status: idx === 0 ? "in_progress" : "locked",
      frontierCpa: ENTRY_CPA,
      frontierBloom: ENTRY_BLOOM,
      probeCpa: ENTRY_CPA,
      probeBloom: ENTRY_BLOOM,
      consecutiveStruggle: 0,
      questionsAsked: 0,
      askedItemIds: [],
      lagPoints: [],
      pendingReframes: [],
      reframeOutcome: null,
      proceduralCheck: null,
      masteredAtSeq: null,
      cellStatus: {},
    };
  });

  return {
    topicOrder,
    currentTopicIndex: 0,
    topics,
    totalQuestions: 0,
    seqCounter: 0,
    engineTrace: [],
    phase: "warmup",
    warmupRemaining: 2,
    maxQuestions: 40,
    pendingQuestion: null,
  };
}

export function logTrace(state: SessionState, line: string) {
  state.engineTrace.push(line);
  if (state.engineTrace.length > 12) state.engineTrace.shift();
}
