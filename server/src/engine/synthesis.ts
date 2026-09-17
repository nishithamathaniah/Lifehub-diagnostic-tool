import { SessionState } from "./state.js";
import { ResponseRecord } from "../sessionStore.js";
import { TOPICS, getTopic } from "../itemBank/index.js";
import { ANXIETY_QUESTIONS, AnxietyFactor } from "../itemBank/anxietyQuestionnaire.js";
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

export type AnxietyLevel = "low" | "moderate" | "elevated";

export interface MathAnxietyResult {
  answered: boolean;
  overallScore: number;
  maxScore: number;
  level: AnxietyLevel;
  numericalScore: number;
  situationalScore: number;
  factorMax: number;
}

export interface ReportData {
  childName: string;
  grade: string;
  assessedAt: string;
  questionCount: number;
  durationMinutes: number;
  headline: string;
  subheadline: string;
  summary: { mastered: number; skillGap: number; proceduralNotConceptual: number; total: number };
  bloomByStrand: { strand: string; assessed: boolean; deepest: BloomLevel | null }[];
  topics: TopicDiagnosis[];
  mathAnxiety: MathAnxietyResult;
  glossary: { tag: string; label: string; description: string }[];
}

const TAG_LABEL: Record<DiagnosisTag, string> = {
  mastered: "Mastered",
  skill_gap: "Skill gap",
  procedural_not_conceptual: "Procedural, not conceptual",
  not_yet_reached: "Not yet reached",
};

const TAG_RECOMMENDATION: Record<DiagnosisTag, string> = {
  mastered: "Move on — no intervention needed.",
  skill_gap: "Reteach the identified prerequisite directly.",
  procedural_not_conceptual: "Visual / hands-on practice before further abstract drilling.",
  not_yet_reached: "Will be assessed once its prerequisite gap closes.",
};

const ALL_STRANDS = ["Number & Algebra", "Measurement & Geometry", "Ratio & Proportion"];

function fmtSec(ms: number) {
  return `${(ms / 1000).toFixed(1)}s`;
}

function accuracyByCpa(responses: ResponseRecord[], topicId: string) {
  const rows = responses.filter((r) => r.topic_id === topicId && !r.is_procedural_check);
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

function buildTopicDiagnosis(topicId: string, state: SessionState, responses: ResponseRecord[]): TopicDiagnosis {
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
    evidence.push(`Reached Abstract·Analyze with consistent accuracy across representations.`);
  } else {
    // lag_point, or an unresolved in_progress topic at session end
    const proceduralConfirmed = t.proceduralCheck?.correct === true;
    if (proceduralConfirmed) {
      tag = "procedural_not_conceptual";
      const abstractAcc = acc["abstract"];
      const pictorialAcc = acc["pictorial"];
      const concreteAcc = acc["concrete"];
      cpaGapNote = "Abstract ✓ · Pictorial ✗";
      if (abstractAcc) {
        evidence.push(`${abstractAcc.correct}/${abstractAcc.total} correct on Abstract (avg ${fmtSec(abstractAcc.avgSolving)}/question).`);
      }
      const weakerAcc = pictorialAcc && pictorialAcc.total ? pictorialAcc : concreteAcc;
      const weakerLabel = pictorialAcc && pictorialAcc.total ? "Pictorial" : "Concrete";
      if (weakerAcc) {
        evidence.push(`${weakerAcc.correct}/${weakerAcc.total} correct on ${weakerLabel} of the identical relationship.`);
      }
      evidence.push(`The identical relationship, computed correctly in symbols, could not be represented or interpreted visually — a memorized procedure without the underlying concept.`);
    } else {
      tag = "skill_gap";
      cpaGapNote = "Not yet reached";
      const lag = t.lagPoints[t.lagPoints.length - 1];
      if (lag) {
        evidence.push(`Struggle persisted across representations around ${lag.cpa}·${lag.bloom}; ${lag.reason}`);
      }
      evidence.push(`This reflects the skill assessment alone — see the separate Math Confidence Check below for whether anxiety may also be a factor.`);
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
  const skillGap = topics.find((t) => t.tag === "skill_gap");

  const masteredList = mastered.map((t) => t.name.toLowerCase()).join(" and ");

  if (procedural) {
    return {
      headline: `${childName} computes ${procedural.name.toLowerCase()} correctly in symbols — the lag shows up specifically in representing it visually, not in the arithmetic itself.`,
      subheadline: `Across the session, ${childName} answered abstract/symbolic questions on this topic correctly, but could not identify or complete the identical relationship shown as a bar model. This usually means a procedure was memorized ahead of the underlying concept — it is not a sign the arithmetic needs re-teaching.`,
    };
  }
  if (skillGap) {
    return {
      headline: mastered.length
        ? `${childName} is solid on ${masteredList} — but has a prerequisite gap in ${skillGap.name.toLowerCase()}.`
        : `${childName} has a prerequisite gap in ${skillGap.name.toLowerCase()} that is holding back later topics.`,
      subheadline: `This is what the skill assessment alone shows. The separate Math Confidence Check below looks at whether anxiety may also be part of the picture — read both sections together before deciding how to respond.`,
    };
  }
  return {
    headline: `${childName} shows full mastery across every topic assessed this session.`,
    subheadline: `Accuracy stayed consistent across Concrete, Pictorial, and Abstract representations. See the separate Math Confidence Check below for how ${childName} feels about math day-to-day.`,
  };
}

/**
 * Scored from the standalone anxiety questionnaire (see anxietyQuestionnaire.ts) —
 * a separate instrument, not derived from in-session behaviour. Each item is
 * 1 (not worried) to 3 (very worried). The low/moderate/elevated bands below
 * are our own reasonable split of the score range, not official published
 * SEMA norms — treat them as a rough read, not a clinical cutoff, until this
 * can be validated against real pilot data.
 */
function computeMathAnxiety(state: SessionState): MathAnxietyResult {
  const factorMax = ANXIETY_QUESTIONS.filter((q) => q.factor === "numerical").length * 3;
  const maxScore = ANXIETY_QUESTIONS.length * 3;

  if (state.anxietyResponses.length === 0) {
    return { answered: false, overallScore: 0, maxScore, level: "low", numericalScore: 0, situationalScore: 0, factorMax };
  }

  const scoreByQuestion = new Map(state.anxietyResponses.map((r) => [r.questionId, r.score]));
  const scoreFor = (factor: AnxietyFactor) =>
    ANXIETY_QUESTIONS.filter((q) => q.factor === factor).reduce((sum, q) => sum + (scoreByQuestion.get(q.id) ?? 0), 0);

  const numericalScore = scoreFor("numerical");
  const situationalScore = scoreFor("situational");
  const overallScore = numericalScore + situationalScore;

  const ratio = overallScore / maxScore;
  const level: AnxietyLevel = ratio >= 0.72 ? "elevated" : ratio >= 0.5 ? "moderate" : "low";

  return { answered: true, overallScore, maxScore, level, numericalScore, situationalScore, factorMax };
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
  const mathAnxiety = computeMathAnxiety(state);

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
    mathAnxiety,
    glossary: [
      { tag: "skill_gap", label: TAG_LABEL.skill_gap, description: "A genuine prerequisite is missing and should be retaught — usually resolved by reteaching, not more drilling of the same kind." },
      { tag: "procedural_not_conceptual", label: TAG_LABEL.procedural_not_conceptual, description: "The method is memorized but not understood — usually resolved with visual/hands-on practice rather than more drilling." },
    ],
  };
}
