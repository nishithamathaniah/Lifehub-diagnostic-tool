import { nanoid } from "nanoid";
import { db } from "./db.js";
import { SessionState, createInitialState } from "./engine/state.js";

export interface SessionRow {
  id: string;
  child_name: string;
  grade: string;
  created_at: string;
  status: string;
  state: string;
}

export function createSession(childName: string, grade: string): { id: string; state: SessionState } {
  const id = nanoid(10);
  const state = createInitialState();
  db.prepare(
    `INSERT INTO sessions (id, child_name, grade, created_at, status, state) VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, childName, grade, new Date().toISOString(), "in_progress", JSON.stringify(state));
  return { id, state };
}

export function getSessionRow(sessionId: string): SessionRow {
  const row = db.prepare(`SELECT * FROM sessions WHERE id = ?`).get(sessionId) as SessionRow | undefined;
  if (!row) throw new Error(`Session ${sessionId} not found`);
  return row;
}

export function getSessionState(sessionId: string): SessionState {
  const row = getSessionRow(sessionId);
  return JSON.parse(row.state) as SessionState;
}

export function saveSessionState(sessionId: string, state: SessionState, status?: string) {
  if (status) {
    db.prepare(`UPDATE sessions SET state = ?, status = ? WHERE id = ?`).run(JSON.stringify(state), status, sessionId);
  } else {
    db.prepare(`UPDATE sessions SET state = ? WHERE id = ?`).run(JSON.stringify(state), sessionId);
  }
}

export interface ResponseRecord {
  id: string;
  session_id: string;
  seq: number;
  topic_id: string;
  item_id: string;
  cpa: string;
  bloom: string;
  subskill: string;
  choice_id: string;
  correct: number;
  hesitation_before_start_ms: number;
  solving_duration_ms: number;
  answer_changes: number;
  pulse: string | null;
  is_reframe: number;
  reframe_of_seq: number | null;
  is_procedural_check: number;
  outcome: string | null;
}

export function insertResponse(r: Omit<ResponseRecord, "id">): ResponseRecord {
  const id = nanoid(12);
  db.prepare(
    `INSERT INTO responses (id, session_id, seq, topic_id, item_id, cpa, bloom, subskill, choice_id, correct, hesitation_before_start_ms, solving_duration_ms, answer_changes, pulse, is_reframe, reframe_of_seq, is_procedural_check, outcome)
     VALUES (@id, @session_id, @seq, @topic_id, @item_id, @cpa, @bloom, @subskill, @choice_id, @correct, @hesitation_before_start_ms, @solving_duration_ms, @answer_changes, @pulse, @is_reframe, @reframe_of_seq, @is_procedural_check, @outcome)`
  ).run({ id, ...r });
  return { id, ...r };
}

export function updateResponseOutcome(id: string, outcome: string) {
  db.prepare(`UPDATE responses SET outcome = ? WHERE id = ?`).run(outcome, id);
}

export function getResponses(sessionId: string): ResponseRecord[] {
  return db.prepare(`SELECT * FROM responses WHERE session_id = ? ORDER BY seq ASC`).all(sessionId) as ResponseRecord[];
}
