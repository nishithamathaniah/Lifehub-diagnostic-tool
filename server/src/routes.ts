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
import { sanitizeItemForClient, getItemById } from "./itemBank/index.js";
import { logTrace } from "./engine/state.js";
import { buildGrid, buildSessionMap, buildBreadcrumb } from "./engine/view.js";
import { synthesizeReport } from "./engine/synthesis.js";
import { getTopic } from "./itemBank/index.js";

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
      state.phase = "completed";
      await saveSessionState(sessionId, state, "completed");
      return res.json({ done: true });
    }
    state.seqCounter += 1;
    state.pendingQuestion = {
      seq: state.seqCounter,
      itemId: next.item.id,
      topicId: next.item.topicId,
      cpa: next.item.cpa,
      bloom: next.item.bloom,
      isReframe: next.isReframe,
      reframeOfSeq: next.reframeOfSeq,
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
    questionNumber: state.totalQuestions + 1,
    maxQuestions: state.maxQuestions,
    isReframe: pq.isReframe,
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

  const responseRow = await insertResponse({
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
    is_reframe: pq.isReframe ? 1 : 0,
    reframe_of_seq: pq.reframeOfSeq,
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
      lowHesitation: signal.lowHesitation,
      isReframe: pq.isReframe,
      reframeOfSeq: pq.reframeOfSeq,
      isProceduralCheck: pq.isProceduralCheck,
      seq: pq.seq,
    });
  }

  state.pendingQuestion = null;
  await saveSessionState(sessionId, state);

  res.json({
    correct,
    outcome: loopOutcome,
    signal: { longPauseBeforeStart: signal.longPauseBeforeStart, quickGuess: signal.quickGuess, lowHesitation: signal.lowHesitation },
    phase: state.phase,
    totalQuestions: state.totalQuestions,
    maxQuestions: state.maxQuestions,
  });
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
