import { BLOOM_CEILING, CPA_ORDER, BloomLevel, CPAStage, cellId } from "../types.js";
import { SessionState, logTrace } from "./state.js";
import { findItem, getItemById, getTopic, ALL_ITEMS } from "../itemBank/index.js";
import { Item } from "../types.js";

const CLIMB_BLOOM_ORDER: BloomLevel[] = ["understand", "apply", "analyze"];
const LAG_THRESHOLD = 5;
const REFRAME_DELAY_QUESTIONS = 5;

export interface NextQuestion {
  item: Item;
  isReframe: boolean;
  reframeOfSeq: number | null;
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

function dueReframe(state: SessionState, topicId: string) {
  const t = state.topics[topicId];
  return t.pendingReframes.find((r) => !r.presented && state.seqCounter >= r.scheduledAtSeq);
}

function dueProceduralCheck(state: SessionState, topicId: string) {
  const t = state.topics[topicId];
  const pc = t.proceduralCheck;
  if (pc && !pc.presented && state.seqCounter >= pc.scheduledAtSeq) return pc;
  return null;
}

export function selectNextQuestion(state: SessionState): NextQuestion | null {
  if (state.totalQuestions >= state.maxQuestions) return null;

  // Warm-up: easy, explicitly low-stakes items to calibrate baseline pace.
  if (state.phase === "warmup") {
    const askedSoFar = 2 - state.warmupRemaining;
    const topicForWarmup = state.topicOrder[askedSoFar % state.topicOrder.length];
    const item = findBestItem(topicForWarmup, "concrete", "remember");
    return { item, isReframe: false, reframeOfSeq: null, isProceduralCheck: false };
  }

  const topicId = activeTopicId(state);
  if (!topicId) return null; // nothing left to test — assessment complete
  const t = state.topics[topicId];

  // The procedural-vs-conceptual side-probe fires soon after a struggle —
  // it's a quick check, not a delayed reframe, so it takes first priority.
  const pc = dueProceduralCheck(state, topicId);
  if (pc) {
    const item = getItemById(pc.itemId);
    return { item, isReframe: false, reframeOfSeq: null, isProceduralCheck: true };
  }

  // A due reframe probe takes priority once its cooldown has elapsed —
  // it needs to land later in the session so the "no pressure" framing is credible.
  const reframe = dueReframe(state, topicId);
  if (reframe) {
    const item = getItemById(reframe.itemId);
    return { item, isReframe: true, reframeOfSeq: reframe.originalSeq, isProceduralCheck: false };
  }

  const item = findBestItem(topicId, t.probeCpa, t.probeBloom);
  return { item, isReframe: false, reframeOfSeq: null, isProceduralCheck: false };
}

export interface OutcomeInput {
  topicId: string;
  cpa: CPAStage;
  bloom: BloomLevel;
  correct: boolean;
  lowHesitation: boolean;
  isReframe: boolean;
  reframeOfSeq: number | null;
  isProceduralCheck: boolean;
  seq: number;
}

export type LoopOutcome =
  | "cleared"
  | "struggle"
  | "reframe_recovered"
  | "reframe_confirmed"
  | "procedural_confirmed"
  | "procedural_ruled_out";

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

  if (input.isReframe) {
    const pending = t.pendingReframes.find((r) => r.originalSeq === input.reframeOfSeq);
    if (pending) pending.presented = true;
    if (input.correct) {
      t.reframeOutcome = "recovered";
      logTrace(state, `Reframe probe on ${topic.shortLabel} recovered → anxiety-flagged, not a skill gap.`);
      return "reframe_recovered";
    } else {
      t.reframeOutcome = "confirmed";
      logTrace(state, `Reframe probe on ${topic.shortLabel} still missed → confirmed skill gap.`);
      return "reframe_confirmed";
    }
  }

  const atFrontier = input.cpa === t.frontierCpa && input.bloom === t.frontierBloom;

  if (input.correct && input.lowHesitation) {
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

  // STRUGGLE — drop one cell, probe laterally, and (once per topic) queue a reframe probe.
  // The struggle count tracks the frontier, not the scaffolding, so it only resets on a real clear.
  t.cellStatus[cellId({ cpa: input.cpa, bloom: input.bloom })] = "struggled";
  t.consecutiveStruggle += 1;

  // After a second struggle while still below Abstract, run a quick side-probe:
  // can the child compute the identical relationship symbolically? A yes here is
  // the "procedural without conceptual grounding" signature from Section 04 —
  // distinct from both a plain skill gap and an anxiety pattern.
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

  const hasReframeAlready = t.pendingReframes.length > 0;
  if (!hasReframeAlready) {
    const frontierItem = findBestItem(input.topicId, t.frontierCpa, t.frontierBloom);
    t.pendingReframes.push({
      itemId: frontierItem.id,
      cpa: t.frontierCpa,
      bloom: t.frontierBloom,
      subskill: frontierItem.subskill,
      originalSeq: input.seq,
      scheduledAtSeq: state.seqCounter + REFRAME_DELAY_QUESTIONS,
      presented: false,
    });
    logTrace(state, `${topic.shortLabel}: struggle at ${t.frontierCpa}·${t.frontierBloom} → queued reframe probe for later, untimed.`);
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
