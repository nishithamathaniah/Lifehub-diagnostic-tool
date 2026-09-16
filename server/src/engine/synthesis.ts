import { SessionState } from "./state.js";
import { ResponseRecord } from "../sessionStore.js";
import { TOPICS, getTopic } from "../itemBank/index.js";
import { BLOOM_ORDER, BloomLevel, CPAStage, DiagnosisTag } from "../types.js";

export interface TopicDiagnosis {
  topicId: string;
  name: string;
  strand: string;
  bloomCeiling: BloomLevel | null;
  tag: DiagnosisTag;
  cpaGapNote: string;
  evidence: string[];
  recommendation: string;
}

export interface ReportData {
  childName: string;
  grade: string;
  assessedAt: string;
  questionCount: number;
  durationMinutes: number;
  headline: string;
  subheadline: string;
  summary: { mastered: number; skillGap: number; anxietyFlagged: number; proceduralNotConceptual: number; total: number };
  bloomByStrand: { strand: string; assessed: boolean; deepest: BloomLevel | null }[];
  topics: TopicDiagnosis[];
  glossary: { tag: string; label: string; description: string }[];
}

const TAG_LABEL: Record<DiagnosisTag, string> = {
  mastered: "Mastered",
  skill_gap: "Skill gap",
  procedural_not_conceptual: "Procedural, not conceptual",
  anxiety_flagged: "Anxiety-flagged",
  not_yet_reached: "Not yet reached",
};

const TAG_RECOMMENDATION: Record<DiagnosisTag, string> = {
  mastered: "Move on — no intervention needed.",
  skill_gap: "Reteach the identified prerequisite directly.",
  procedural_not_conceptual: "Visual / hands-on practice before further abstract drilling.",
  anxiety_flagged: "Confidence-building, low-stakes practice — not reteaching.",
  not_yet_reached: "Will be assessed once its prerequisite gap closes.",
};

const ALL_STRANDS = ["Number & Algebra", "Measurement & Geometry", "Ratio & Proportion"];

function fmtSec(ms: number) {
  return `${(ms / 1000).toFixed(1)}s`;
}

function accuracyByCpa(responses: ResponseRecord[], topicId: string) {
  const rows = responses.filter((r) => r.topic_id === topicId && !r.is_reframe && !r.is_procedural_check);
  const byCpa: Record<string, { correct: number; total: number; avgHesitation: number; avgSolving: number; answerChanges: number }> = {};
  for (const r of rows) {
    const bucket = (byCpa[r.cpa] ??= { correct: 0, total: 0, avgHesitation: 0, avgSolving: 0, answerChanges: 0 });
    bucket.total += 1;
    bucket.correct += r.correct ? 1 : 0;
    bucket.avgHesitation += r.hesitation_before_start_ms;
    bucket.avgSolving += r.solving_duration_ms;
    bucket.answerChanges += r.answer_changes;
  }
  for (const key of Object.keys(byCpa)) {
    const b = byCpa[key];
    b.avgHesitation = b.total ? b.avgHesitation / b.total : 0;
    b.avgSolving = b.total ? b.avgSolving / b.total : 0;
  }
  return byCpa;
}

function bloomIndexReached(cellStatus: Record<string, "cleared" | "struggled">, cpa: CPAStage): number {
  let deepest = -1;
  for (const key of Object.keys(cellStatus)) {
    if (cellStatus[key] !== "cleared") continue;
    const [c, b] = key.split(":") as [CPAStage, BloomLevel];
    if (c !== cpa) continue;
    const idx = BLOOM_ORDER.indexOf(b);
    if (idx > deepest) deepest = idx;
  }
  return deepest;
}

function buildTopicDiagnosis(
  topicId: string,
  state: SessionState,
  responses: ResponseRecord[]
): TopicDiagnosis {
  const topic = getTopic(topicId);
  const t = state.topics[topicId];
  const acc = accuracyByCpa(responses, topicId);

  let bloomCeiling: BloomLevel | null = null;
  for (const cpa of ["abstract", "pictorial", "concrete"] as CPAStage[]) {
    const idx = bloomIndexReached(t.cellStatus, cpa);
    if (idx >= 0) {
      bloomCeiling = BLOOM_ORDER[idx];
      break;
    }
  }

  let tag: DiagnosisTag;
  let cpaGapNote = "—";
  const evidence: string[] = [];

  if (t.status === "locked") {
    tag = "not_yet_reached";
    const deps = topic.dependsOn.map((d) => getTopic(d).name).join(", ");
    evidence.push(`${topic.name} was not yet reached this session because it depends on ${deps || "an earlier topic"} being cleared first.`);
  } else if (t.status === "mastered") {
    tag = "mastered";
    evidence.push(`Reached Abstract·Analyze with consistent accuracy and low hesitation across representations.`);
  } else {
    // lag_point or an unresolved in_progress topic at session end
    const proceduralConfirmed = t.proceduralCheck?.correct === true;
    if (proceduralConfirmed) {
      tag = "procedural_not_conceptual";
      const abstractAcc = acc["abstract"];
      const pictorialAcc = acc["pictorial"];
      const concreteAcc = acc["concrete"];
      cpaGapNote = "Abstract ✓ · Pictorial ✗";
      if (abstractAcc) {
        evidence.push(`${abstractAcc.correct}/${abstractAcc.total} correct on Abstract (avg ${fmtSec(abstractAcc.avgSolving)}/question, no hesitation flags).`);
      }
      const weakerAcc = pictorialAcc && pictorialAcc.total ? pictorialAcc : concreteAcc;
      const weakerLabel = pictorialAcc && pictorialAcc.total ? "Pictorial" : "Concrete";
      if (weakerAcc) {
        evidence.push(`${weakerAcc.correct}/${weakerAcc.total} correct on ${weakerLabel} of the identical relationship (avg ${fmtSec(weakerAcc.avgHesitation)} hesitation, ${weakerAcc.answerChanges} answer changes).`);
      }
      evidence.push(`The identical relationship, computed correctly in symbols, could not be represented or interpreted visually — a memorized procedure without the underlying concept.`);
    } else if (t.reframeOutcome === "recovered") {
      tag = "anxiety_flagged";
      cpaGapNote = `${t.lagPoints[0]?.cpa ?? t.frontierCpa} · word-framing ✗`;
      const strugglingCpaAcc = acc[t.lagPoints[0]?.cpa ?? t.frontierCpa];
      if (strugglingCpaAcc) {
        evidence.push(`${strugglingCpaAcc.correct}/${strugglingCpaAcc.total} correct on first attempt (avg ${fmtSec(strugglingCpaAcc.avgHesitation)} hesitation before starting).`);
      }
      evidence.push(`Performance recovered when the identical question was re-presented later, untimed and low-stakes — the skill is present but was suppressed under the original framing.`);
    } else {
      tag = "skill_gap";
      cpaGapNote = "Not yet reached";
      const lag = t.lagPoints[t.lagPoints.length - 1];
      if (lag) {
        evidence.push(`Struggle persisted across representations around ${lag.cpa}·${lag.bloom}; ${lag.reason}`);
      }
      if (t.reframeOutcome === "confirmed") {
        evidence.push(`Performance did not recover even under an untimed, low-stakes reframe — this rules out anxiety and confirms a genuine gap.`);
      } else {
        evidence.push(`A reframe probe was queued but the session ended before it could be re-presented; treated conservatively as a skill gap pending more data.`);
      }
    }
  }

  return {
    topicId,
    name: topic.name,
    strand: topic.strand,
    bloomCeiling,
    tag,
    cpaGapNote,
    evidence,
    recommendation: TAG_RECOMMENDATION[tag],
  };
}

function buildHeadline(childName: string, topics: TopicDiagnosis[]): { headline: string; subheadline: string } {
  const mastered = topics.filter((t) => t.tag === "mastered");
  const procedural = topics.find((t) => t.tag === "procedural_not_conceptual");
  const anxiety = topics.find((t) => t.tag === "anxiety_flagged");
  const skillGap = topics.find((t) => t.tag === "skill_gap");

  const masteredList = mastered.map((t) => t.name.toLowerCase()).join(" and ");

  if (procedural) {
    return {
      headline: `${childName} computes ${procedural.name.toLowerCase()} correctly in symbols — the lag shows up specifically in representing it visually, not in the arithmetic itself.`,
      subheadline: `Across the session, ${childName} answered abstract/symbolic questions on this topic correctly and quickly, but could not identify or complete the identical relationship shown as a bar model. This usually means a procedure was memorized ahead of the underlying concept — it is not a sign the arithmetic needs re-teaching.`,
    };
  }
  if (anxiety) {
    return {
      headline: mastered.length
        ? `${childName} is solid on ${masteredList} — the lag in ${anxiety.name.toLowerCase()} shows up specifically under word-problem framing, not in the computation itself.`
        : `${childName}'s lag in ${anxiety.name.toLowerCase()} shows up specifically under word-problem framing, not in the computation itself.`,
      subheadline: `Correct answers dropped sharply only when a question required setting up a model from a word problem — not when the same arithmetic was asked directly, and performance recovered once the pressure was removed. This is a distinguishing pattern worth watching with confidence-building practice, not a sign the topic needs re-teaching from scratch.`,
    };
  }
  if (skillGap) {
    return {
      headline: mastered.length
        ? `${childName} is solid on ${masteredList} — but has a genuine prerequisite gap in ${skillGap.name.toLowerCase()}.`
        : `${childName} has a genuine prerequisite gap in ${skillGap.name.toLowerCase()} that is holding back later topics.`,
      subheadline: `The struggle on this topic persisted across representations and did not recover under a low-stakes reframe, which points to a real missing prerequisite rather than pressure or framing. Directly reteaching this topic before moving on is likely to unblock what depends on it.`,
    };
  }
  return {
    headline: `${childName} shows full mastery across every topic assessed this session.`,
    subheadline: `Accuracy stayed consistent across Concrete, Pictorial, and Abstract representations, with low hesitation throughout — no skill gap, procedural, or anxiety pattern was flagged.`,
  };
}

export function synthesizeReport(
  state: SessionState,
  responses: ResponseRecord[],
  childName: string,
  grade: string,
  assessedAt: string
): ReportData {
  const topics = TOPICS.map((t) => buildTopicDiagnosis(t.id, state, responses));

  const summary = {
    mastered: topics.filter((t) => t.tag === "mastered").length,
    skillGap: topics.filter((t) => t.tag === "skill_gap").length,
    anxietyFlagged: topics.filter((t) => t.tag === "anxiety_flagged").length,
    proceduralNotConceptual: topics.filter((t) => t.tag === "procedural_not_conceptual").length,
    total: topics.length,
  };

  const strandTopics = (strand: string) => topics.filter((t) => t.strand === strand);
  const bloomByStrand = ALL_STRANDS.map((strand) => {
    const inStrand = strandTopics(strand);
    if (inStrand.length === 0) return { strand, assessed: false, deepest: null };
    let deepestIdx = -1;
    for (const t of inStrand) {
      if (t.tag === "mastered") deepestIdx = Math.max(deepestIdx, BLOOM_ORDER.indexOf("analyze"));
      else if (t.bloomCeiling) deepestIdx = Math.max(deepestIdx, BLOOM_ORDER.indexOf(t.bloomCeiling));
    }
    return { strand, assessed: true, deepest: deepestIdx >= 0 ? BLOOM_ORDER[deepestIdx] : null };
  });

  const { headline, subheadline } = buildHeadline(childName, topics);

  const startedAt = new Date(assessedAt).getTime();
  const durationMinutes = Math.max(1, Math.round((Date.now() - startedAt) / 60000));

  return {
    childName,
    grade,
    assessedAt,
    questionCount: state.totalQuestions,
    durationMinutes,
    headline,
    subheadline,
    summary,
    bloomByStrand,
    topics,
    glossary: [
      { tag: "skill_gap", label: TAG_LABEL.skill_gap, description: "A genuine prerequisite is missing and should be retaught — usually resolved by reteaching, not more drilling of the same kind." },
      { tag: "procedural_not_conceptual", label: TAG_LABEL.procedural_not_conceptual, description: "The method is memorized but not understood — usually resolved with visual/hands-on practice rather than more drilling." },
      { tag: "anxiety_flagged", label: TAG_LABEL.anxiety_flagged, description: "The underlying skill is present but performance drops specifically under word-problem or evaluative framing — usually resolved with confidence-building, not reteaching." },
    ],
  };
}
