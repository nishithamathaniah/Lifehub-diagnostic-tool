import { Router } from "express";
import {
  createSession,
  getSessionRow,
  getSessionState,
  saveSessionState,
  insertResponse,
  getResponses,
} from "./sessionStore.js";
import { selectNextQuestion, applyOutcome } from "./engine/skillEngine.js";
import { readSignal } from "./engine/signalEngine.js";
import { sanitizeItemForClient, getItemById, getTopic } from "./itemBank/index.js";
import { ANXIETY_QUESTIONS } from "./itemBank/anxietyQuestionnaire.js";
import { logTrace } from "./engine/state.js";
import { buildGrid, buildSessionMap, buildBreadcrumb } from "./engine/view.js";
import { synthesizeReport } from "./engine/synthesis.js";

export const router = Router();

router.post("/sessions", async (req, res) => {
  const { childName, grade } = req.body ?? {};
  if (!childName || typeof childName !== "string" || !childName.trim()) {
    return res.status(400).json({ error: "childName is required" });
  }
  const { id } = await createSession(childName.trim().slice(0, 80), grade || "Grade 5");
  res.json({ sessionId: id });
});

router.get("/sessions/:id/next-question", async (req, res) => {
  const sessionId = req.params.id;
  let state;
  try {
    state = await getSessionState(sessionId);
  } catch {
    return res.status(404).json({ error: "session not found" });
  }

  // Re-serve the already-pending question if the client refreshed mid-question.
  if (!state.pendingQuestion) {
    const next = selectNextQuestion(state);
    if (!next) {
      // The skill assessment (its own instrument) is done. The anxiety
      // questionnaire is a separate instrument administered next, not
      // interleaved with it — see anxietyQuestionnaire.ts for why.
      state.phase = "anxiety_questionnaire";
      await saveSessionState(sessionId, state);
      return res.json({ done: true, nextPhase: "anxiety_questionnaire" });
    }
    state.seqCounter += 1;
    state.pendingQuestion = {
      seq: state.seqCounter,
      itemId: next.item.id,
      topicId: next.item.topicId,
      cpa: next.item.cpa,
      bloom: next.item.bloom,
      isProceduralCheck: next.isProceduralCheck,
      clientItem: sanitizeItemForClient(next.item),
      shownAtServerMs: Date.now(),
    };
    await saveSessionState(sessionId, state);
  }

  const pq = state.pendingQuestion!;
  const topicIdForView = state.phase === "warmup" ? null : pq.topicId;

  res.json({
    done: false,
    phase: state.phase,
    seq: pq.seq,
    // pq.seq increments for every question shown, including warm-up — using
    // totalQuestions here instead would freeze the displayed number during
    // warm-up, since that counter only advances once real scoring starts.
    questionNumber: pq.seq,
    maxQuestions: state.maxQuestions,
    isProceduralCheck: pq.isProceduralCheck,
    breadcrumb: buildBreadcrumb(topicIdForView, state),
    topicName: topicIdForView ? getTopic(topicIdForView).name : "Warm-up",
    item: pq.clientItem,
    grid: topicIdForView ? buildGrid(topicIdForView, state) : [],
    sessionMap: buildSessionMap(state),
    engineTrace: state.engineTrace.slice(-6),
  });
});

router.post("/sessions/:id/answer", async (req, res) => {
  const sessionId = req.params.id;
  let state;
  try {
    state = await getSessionState(sessionId);
  } catch {
    return res.status(404).json({ error: "session not found" });
  }

  const pq = state.pendingQuestion;
  if (!pq) return res.status(400).json({ error: "no pending question for this session" });

  const { choiceId, hesitationBeforeStartMs, solvingDurationMs, answerChanges, pulse } = req.body ?? {};
  if (typeof choiceId !== "string") return res.status(400).json({ error: "choiceId is required" });

  const item = getItemById(pq.itemId);
  const correct = item.correctChoiceId === choiceId;
  const signal = readSignal({
    hesitationBeforeStartMs: Number(hesitationBeforeStartMs) || 0,
    solvingDurationMs: Number(solvingDurationMs) || 0,
    answerChanges: Number(answerChanges) || 0,
  });

  await insertResponse({
    session_id: sessionId,
    seq: pq.seq,
    topic_id: pq.topicId,
    item_id: pq.itemId,
    cpa: pq.cpa,
    bloom: pq.bloom,
    subskill: item.subskill,
    choice_id: choiceId,
    correct: correct ? 1 : 0,
    hesitation_before_start_ms: signal.hesitationBeforeStartMs,
    solving_duration_ms: signal.solvingDurationMs,
    answer_changes: Number(answerChanges) || 0,
    pulse: typeof pulse === "string" ? pulse : null,
    is_reframe: 0,
    reframe_of_seq: null,
    is_procedural_check: pq.isProceduralCheck ? 1 : 0,
    outcome: null,
  });

  let loopOutcome: string = "warmup";
  if (state.phase === "warmup") {
    state.warmupRemaining = Math.max(0, state.warmupRemaining - 1);
    logTrace(state, `Warm-up ${2 - state.warmupRemaining}/2 complete.`);
    if (state.warmupRemaining === 0) {
      state.phase = "assessment";
      logTrace(state, "Warm-up complete — baseline pace calibrated. Starting dynamic assessment.");
    }
  } else {
    loopOutcome = applyOutcome(state, {
      topicId: pq.topicId,
      cpa: pq.cpa,
      bloom: pq.bloom,
      correct,
      isProceduralCheck: pq.isProceduralCheck,
      seq: pq.seq,
    });
  }

  state.pendingQuestion = null;
  await saveSessionState(sessionId, state);

  res.json({
    correct,
    outcome: loopOutcome,
    phase: state.phase,
    totalQuestions: state.totalQuestions,
    maxQuestions: state.maxQuestions,
  });
});

// --- Anxiety questionnaire: a separate instrument, administered after the
// skill assessment finishes. Not adaptive — all questions are fetched and
// answered together, like the standalone self-report scales it's adapted from.

router.get("/sessions/:id/anxiety-questions", async (req, res) => {
  const sessionId = req.params.id;
  try {
    await getSessionState(sessionId);
  } catch {
    return res.status(404).json({ error: "session not found" });
  }
  res.json({ questions: ANXIETY_QUESTIONS.map((q) => ({ id: q.id, text: q.text })) });
});

router.post("/sessions/:id/anxiety-answers", async (req, res) => {
  const sessionId = req.params.id;
  let state;
  try {
    state = await getSessionState(sessionId);
  } catch {
    return res.status(404).json({ error: "session not found" });
  }

  const { responses } = req.body ?? {};
  if (!Array.isArray(responses)) return res.status(400).json({ error: "responses array is required" });

  const validIds = new Set(ANXIETY_QUESTIONS.map((q) => q.id));
  const cleaned = responses
    .filter((r: unknown): r is { questionId: string; score: number } => {
      const rec = r as { questionId?: unknown; score?: unknown };
      return typeof rec?.questionId === "string" && validIds.has(rec.questionId) && [1, 2, 3].includes(Number(rec?.score));
    })
    .map((r) => ({ questionId: r.questionId, score: Number(r.score) }));

  state.anxietyResponses = cleaned;
  state.phase = "completed";
  logTrace(state, `Anxiety questionnaire complete (${cleaned.length}/${ANXIETY_QUESTIONS.length} answered).`);
  await saveSessionState(sessionId, state, "completed");

  res.json({ ok: true });
});

router.get("/sessions/:id/report", async (req, res) => {
  const sessionId = req.params.id;
  let state, row;
  try {
    state = await getSessionState(sessionId);
    row = await getSessionRow(sessionId);
  } catch {
    return res.status(404).json({ error: "session not found" });
  }
  const responses = await getResponses(sessionId);
  const report = synthesizeReport(state, responses, row.child_name, row.grade, row.created_at);
  res.json(report);
});
