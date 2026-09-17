import { BLOOM_CEILING, BLOOM_ORDER, CPA_ORDER, BloomLevel, CPAStage, cellId } from "../types.js";
import { SessionState, logTrace } from "./state.js";
import { findItem, getItemById, getTopic, ALL_ITEMS } from "../itemBank/index.js";
import { Item } from "../types.js";

const CLIMB_BLOOM_ORDER: BloomLevel[] = ["understand", "apply", "analyze"];
const LAG_THRESHOLD = 4;

export interface NextQuestion {
  item: Item;
  isProceduralCheck: boolean;
}

function cpaIndex(cpa: CPAStage) {
  return CPA_ORDER.indexOf(cpa);
}

function dropCpa(cpa: CPAStage): CPAStage {
  const idx = cpaIndex(cpa);
  return CPA_ORDER[Math.max(0, idx - 1)];
}

function stepCpaForward(cpa: CPAStage): CPAStage | null {
  // Forward climbing only ever runs pictorial -> abstract; concrete is a back-probe-only stage.
  if (cpa === "pictorial") return "abstract";
  if (cpa === "concrete") return "pictorial";
  return null; // already at abstract, nowhere further forward
}

function findBestItem(topicId: string, cpa: CPAStage, bloom: BloomLevel): Item {
  const exact = findItem(topicId, cpa, bloom);
  if (exact) return exact;
  // fall back to nearest authored cell so the engine never stalls on a thin item bank
  const sameTopic = ALL_ITEMS.filter((it) => it.topicId === topicId);
  const sameCpa = sameTopic.find((it) => it.cpa === cpa);
  if (sameCpa) return sameCpa;
  return sameTopic[0];
}

/** Picks whichever unlocked topic still has work left, in prerequisite order. */
function activeTopicId(state: SessionState): string | null {
  for (const topicId of state.topicOrder) {
    const t = state.topics[topicId];
    if (t.status === "in_progress") return topicId;
  }
  // nothing in_progress: try to unlock the next locked topic whose prerequisites are mastered
  for (const topicId of state.topicOrder) {
    const t = state.topics[topicId];
    if (t.status !== "locked") continue;
    const topic = getTopic(topicId);
    const prereqsMet = topic.dependsOn.every((dep) => state.topics[dep]?.status === "mastered");
    if (prereqsMet) {
      t.status = "in_progress";
      logTrace(state, `Prerequisites cleared → unlocked ${topic.name}.`);
      return topicId;
    }
  }
  return null;
}

function dueProceduralCheck(state: SessionState, topicId: string) {
  const t = state.topics[topicId];
  const pc = t.proceduralCheck;
  if (pc && !pc.presented && state.seqCounter >= pc.scheduledAtSeq) return pc;
  return null;
}

/**
 * Returns null once the skill assessment itself is done — the caller
 * transitions to the separate anxiety questionnaire from there (see
 * routes.ts). This function only ever drives the CPA×Bloom skill test.
 */
export function selectNextQuestion(state: SessionState): NextQuestion | null {
  if (state.totalQuestions >= state.maxQuestions) return null;

  // Warm-up: easy items to calibrate baseline pace before the real assessment.
  if (state.phase === "warmup") {
    const askedSoFar = 2 - state.warmupRemaining;
    const topicForWarmup = state.topicOrder[askedSoFar % state.topicOrder.length];
    const item = findBestItem(topicForWarmup, "concrete", "remember");
    return { item, isProceduralCheck: false };
  }

  const topicId = activeTopicId(state);
  if (!topicId) return null; // nothing left to test — skill assessment complete
  const t = state.topics[topicId];

  // The procedural-vs-conceptual side-probe fires soon after a struggle —
  // this is a CPA-representation check (Singapore Math's own pedagogy), not
  // an anxiety-detection mechanism, so it stays.
  const pc = dueProceduralCheck(state, topicId);
  if (pc) {
    const item = getItemById(pc.itemId);
    return { item, isProceduralCheck: true };
  }

  const item = findBestItem(topicId, t.probeCpa, t.probeBloom);
  return { item, isProceduralCheck: false };
}

export interface OutcomeInput {
  topicId: string;
  cpa: CPAStage;
  bloom: BloomLevel;
  correct: boolean;
  isProceduralCheck: boolean;
  seq: number;
}

export type LoopOutcome = "cleared" | "struggle" | "procedural_confirmed" | "procedural_ruled_out";

export function applyOutcome(state: SessionState, input: OutcomeInput): LoopOutcome {
  const t = state.topics[input.topicId];
  const topic = getTopic(input.topicId);
  t.questionsAsked += 1;
  state.totalQuestions += 1;

  if (input.isProceduralCheck && t.proceduralCheck) {
    t.proceduralCheck.presented = true;
    t.proceduralCheck.correct = input.correct;
    if (input.correct) {
      logTrace(state, `${topic.shortLabel}: computes correctly in Abstract despite the Pictorial struggle → procedural without conceptual grounding.`);
      return "procedural_confirmed";
    } else {
      logTrace(state, `${topic.shortLabel}: also missed the Abstract check → genuine gap, not just a representation issue.`);
      return "procedural_ruled_out";
    }
  }

  const atFrontier = input.cpa === t.frontierCpa && input.bloom === t.frontierBloom;

  // Progress is gated on correctness alone — a right answer that took a
  // moment to think through still counts as cleared.
  if (input.correct) {
    t.cellStatus[cellId({ cpa: input.cpa, bloom: input.bloom })] = "cleared";

    if (!atFrontier) {
      // Cleared a scaffolded back-probe, not the actual frontier — climb the probe
      // one step back toward the frontier, but the struggle count stays: the child
      // still hasn't proven they can clear the thing they're actually stuck on.
      const next = stepCpaForward(t.probeCpa);
      t.probeCpa = next && cpaIndex(next) <= cpaIndex(t.frontierCpa) ? next : t.frontierCpa;
      t.probeBloom = t.frontierBloom;
      logTrace(state, `${topic.shortLabel}: cleared the ${input.cpa}·${input.bloom} back-probe → re-approaching frontier via ${t.probeCpa}·${t.probeBloom}.`);
      return "cleared";
    }

    // CLEARED at the frontier itself — climb one cell and reset the struggle count.
    t.consecutiveStruggle = 0;
    const bloomIdx = CLIMB_BLOOM_ORDER.indexOf(t.frontierBloom);
    if (t.frontierBloom === BLOOM_CEILING || bloomIdx === CLIMB_BLOOM_ORDER.length - 1) {
      if (t.frontierCpa === "abstract") {
        t.status = "mastered";
        t.masteredAtSeq = input.seq;
        logTrace(state, `${topic.shortLabel}: Abstract·Analyze cleared → TOPIC MASTERED.`);
      } else {
        const next = stepCpaForward(t.frontierCpa)!;
        t.frontierCpa = next;
        t.frontierBloom = "understand";
        logTrace(state, `${topic.shortLabel}: Bloom ceiling hit at ${input.cpa} → stepping up to ${next}·Understand.`);
      }
    } else {
      t.frontierBloom = CLIMB_BLOOM_ORDER[bloomIdx + 1] ?? "analyze";
      logTrace(state, `${topic.shortLabel}: cleared ${input.cpa}·${input.bloom} → climbing to ${t.frontierCpa}·${t.frontierBloom}.`);
    }
    t.probeCpa = t.frontierCpa;
    t.probeBloom = t.frontierBloom;
    return "cleared";
  }

  // STRUGGLE — drop one cell and probe laterally. The struggle count tracks
  // the frontier, not the scaffolding, so it only resets on a real clear.
  t.cellStatus[cellId({ cpa: input.cpa, bloom: input.bloom })] = "struggled";
  t.consecutiveStruggle += 1;

  // After a second struggle while still below Abstract, run a quick side-probe:
  // can the child compute the identical relationship symbolically? A yes here is
  // the "procedural without conceptual grounding" signature from Section 04 —
  // a CPA-representation gap, distinct from a plain skill gap.
  if (!t.proceduralCheck && t.consecutiveStruggle === 2 && t.frontierCpa !== "abstract") {
    const abstractItem = findBestItem(input.topicId, "abstract", t.frontierBloom);
    if (abstractItem.cpa === "abstract") {
      t.proceduralCheck = {
        itemId: abstractItem.id,
        subskill: abstractItem.subskill,
        scheduledAtSeq: state.seqCounter + 1,
        presented: false,
        correct: null,
      };
      logTrace(state, `${topic.shortLabel}: queued an Abstract side-probe on the identical relationship to check for a memorized-but-not-understood pattern.`);
    }
  }

  if (t.consecutiveStruggle >= LAG_THRESHOLD) {
    t.status = "lag_point";
    t.lagPoints.push({
      cpa: t.frontierCpa,
      bloom: t.frontierBloom,
      subskill: findBestItem(input.topicId, t.frontierCpa, t.frontierBloom).subskill,
      reason: `No traction after ${LAG_THRESHOLD} questions around ${t.frontierCpa}·${t.frontierBloom}.`,
    });
    logTrace(state, `${topic.shortLabel}: LAG POINT logged at ${t.frontierCpa}·${t.frontierBloom} — moving to a different strand.`);
  } else if (t.probeCpa === "concrete") {
    // Already at the scaffolding floor — there's no lower CPA stage to drop to,
    // so re-asking the identical (concrete, frontierBloom) item would just repeat
    // the same question verbatim. Vary the Bloom level instead, cycling through
    // the concrete row's other authored items so each retry is a different question.
    const rotatedIdx = (BLOOM_ORDER.indexOf(t.frontierBloom) + t.consecutiveStruggle) % BLOOM_ORDER.length;
    t.probeBloom = BLOOM_ORDER[rotatedIdx];
    logTrace(state, `${topic.shortLabel}: struggle at the Concrete floor → varying to ${t.probeCpa}·${t.probeBloom} instead of repeating the same item.`);
  } else {
    t.probeCpa = dropCpa(t.probeCpa);
    t.probeBloom = t.frontierBloom;
    logTrace(state, `${topic.shortLabel}: struggle → dropped to ${t.probeCpa}·${t.probeBloom}, probing laterally.`);
  }

  return "struggle";
}

export function cellKeyLabel(cpa: CPAStage, bloom: BloomLevel) {
  return cellId({ cpa, bloom });
}
