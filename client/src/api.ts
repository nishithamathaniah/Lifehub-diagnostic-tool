import { AnswerResponse, NextQuestionResponse, ReportData } from "./types";

const BASE = "/api";

async function asJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export async function createSession(childName: string, grade: string): Promise<string> {
  const res = await fetch(`${BASE}/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ childName, grade }),
  });
  const data = await asJson<{ sessionId: string }>(res);
  return data.sessionId;
}

export async function getNextQuestion(sessionId: string): Promise<NextQuestionResponse> {
  const res = await fetch(`${BASE}/sessions/${sessionId}/next-question`);
  return asJson<NextQuestionResponse>(res);
}

export interface AnswerPayload {
  choiceId: string;
  hesitationBeforeStartMs: number;
  solvingDurationMs: number;
  answerChanges: number;
  pulse: string | null;
}

export async function submitAnswer(sessionId: string, payload: AnswerPayload): Promise<AnswerResponse> {
  const res = await fetch(`${BASE}/sessions/${sessionId}/answer`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return asJson<AnswerResponse>(res);
}

export async function getReport(sessionId: string): Promise<ReportData> {
  const res = await fetch(`${BASE}/sessions/${sessionId}/report`);
  return asJson<ReportData>(res);
}
