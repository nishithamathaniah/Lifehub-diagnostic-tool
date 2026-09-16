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

export async function createSession(childName: string, grade: string): Promise<{ id: string; state: SessionState }> {
  const id = nanoid(10);
  const state = createInitialState();
  await db.execute({
    sql: `INSERT INTO sessions (id, child_name, grade, created_at, status, state) VALUES (?, ?, ?, ?, ?, ?)`,
    args: [id, childName, grade, new Date().toISOString(), "in_progress", JSON.stringify(state)],
  });
  return { id, state };
}

export async function getSessionRow(sessionId: string): Promise<SessionRow> {
  const result = await db.execute({ sql: `SELECT * FROM sessions WHERE id = ?`, args: [sessionId] });
  const row = result.rows[0];
  if (!row) throw new Error(`Session ${sessionId} not found`);
  return row as unknown as SessionRow;
}

export async function getSessionState(sessionId: string): Promise<SessionState> {
  const row = await getSessionRow(sessionId);
  return JSON.parse(row.state as string) as SessionState;
}

export async function saveSessionState(sessionId: string, state: SessionState, status?: string): Promise<void> {
  if (status) {
    await db.execute({
      sql: `UPDATE sessions SET state = ?, status = ? WHERE id = ?`,
      args: [JSON.stringify(state), status, sessionId],
    });
  } else {
    await db.execute({
      sql: `UPDATE sessions SET state = ? WHERE id = ?`,
      args: [JSON.stringify(state), sessionId],
    });
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

export async function insertResponse(r: Omit<ResponseRecord, "id">): Promise<ResponseRecord> {
  const id = nanoid(12);
  await db.execute({
    sql: `INSERT INTO responses (id, session_id, seq, topic_id, item_id, cpa, bloom, subskill, choice_id, correct, hesitation_before_start_ms, solving_duration_ms, answer_changes, pulse, is_reframe, reframe_of_seq, is_procedural_check, outcome)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      id,
      r.session_id,
      r.seq,
      r.topic_id,
      r.item_id,
      r.cpa,
      r.bloom,
      r.subskill,
      r.choice_id,
      r.correct,
      r.hesitation_before_start_ms,
      r.solving_duration_ms,
      r.answer_changes,
      r.pulse,
      r.is_reframe,
      r.reframe_of_seq,
      r.is_procedural_check,
      r.outcome,
    ],
  });
  return { id, ...r };
}

export async function getResponses(sessionId: string): Promise<ResponseRecord[]> {
  const result = await db.execute({
    sql: `SELECT * FROM responses WHERE session_id = ? ORDER BY seq ASC`,
    args: [sessionId],
  });
  return result.rows as unknown as ResponseRecord[];
}
