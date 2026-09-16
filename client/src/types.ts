export type CPAStage = "concrete" | "pictorial" | "abstract";
export type BloomLevel = "remember" | "understand" | "apply" | "analyze" | "evaluate";

export interface BarModelSpec {
  kind: "bar-model";
  totalLabel: string;
  parts: number;
  highlightParts?: number;
  queryPartIndex?: number;
  segmentLabels?: string[];
}

export interface ConcreteSpec {
  kind: "concrete";
  icon: string;
  itemCount: number;
  groups: number;
  groupLabel: string;
}

export type Representation = BarModelSpec | ConcreteSpec | null;

export interface ClientChoice {
  id: string;
  text: string;
}

export interface ClientItem {
  id: string;
  topicId: string;
  cpa: CPAStage;
  bloom: BloomLevel;
  subskill: string;
  prompt: string;
  representation: Representation;
  choices: ClientChoice[];
}

export interface GridCellView {
  cpa: string;
  bloom: string;
  status: "cleared" | "current" | "back-probe" | "untested";
}

export interface SessionMapEntry {
  topicId: string;
  name: string;
  status: string;
}

export interface NextQuestionResponse {
  done: boolean;
  phase?: "warmup" | "assessment" | "completed";
  seq?: number;
  questionNumber?: number;
  maxQuestions?: number;
  isReframe?: boolean;
  isProceduralCheck?: boolean;
  breadcrumb?: string;
  topicName?: string;
  item?: ClientItem;
  grid?: GridCellView[];
  sessionMap?: SessionMapEntry[];
  engineTrace?: string[];
}

export interface AnswerResponse {
  correct: boolean;
  outcome: string;
  signal: { longPauseBeforeStart: boolean; quickGuess: boolean; lowHesitation: boolean };
  phase: string;
  totalQuestions: number;
  maxQuestions: number;
}

export type DiagnosisTag = "mastered" | "skill_gap" | "procedural_not_conceptual" | "anxiety_flagged" | "not_yet_reached";

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
