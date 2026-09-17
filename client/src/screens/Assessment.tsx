import { useEffect, useRef, useState } from "react";
import { getNextQuestion, submitAnswer } from "../api";
import { NextQuestionResponse } from "../types";
import { BarModel } from "../components/BarModel";
import { ConcreteObjects } from "../components/ConcreteObjects";
import { CPABloomGrid } from "../components/CPABloomGrid";
import { SessionMap } from "../components/SessionMap";
import { EngineTrace } from "../components/EngineTrace";
import { PulseCheck } from "../components/PulseCheck";

export function Assessment({ sessionId, onComplete }: { sessionId: string; onComplete: () => void }) {
  const [question, setQuestion] = useState<NextQuestionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  // Hidden by default — per the design doc, the CPA×Bloom grid / session map /
  // engine trace are for reviewer/QA use, not something a child should see
  // during their own session. The toggle is left in for demoing/debugging.
  const [showPanel, setShowPanel] = useState(false);

  const [selectedChoiceId, setSelectedChoiceId] = useState<string | null>(null);
  const [answerChanges, setAnswerChanges] = useState(0);
  const [pulse, setPulse] = useState<string | null>(null);
  const questionShownAt = useRef<number>(0);
  const firstInteractionAt = useRef<number | null>(null);

  async function loadNext() {
    setLoading(true);
    const nq = await getNextQuestion(sessionId);
    if (nq.done) {
      onComplete();
      return;
    }
    setQuestion(nq);
    setSelectedChoiceId(null);
    setAnswerChanges(0);
    setPulse(null);
    firstInteractionAt.current = null;
    questionShownAt.current = performance.now();
    setLoading(false);
  }

  useEffect(() => {
    loadNext();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleChoiceClick(choiceId: string) {
    if (firstInteractionAt.current === null) {
      firstInteractionAt.current = performance.now();
    } else if (choiceId !== selectedChoiceId) {
      setAnswerChanges((n) => n + 1);
    }
    setSelectedChoiceId(choiceId);
  }

  async function handleContinue() {
    if (!selectedChoiceId) return;
    const now = performance.now();
    const hesitationBeforeStartMs = (firstInteractionAt.current ?? now) - questionShownAt.current;
    const solvingDurationMs = now - (firstInteractionAt.current ?? now);
    setLoading(true);
    await submitAnswer(sessionId, {
      choiceId: selectedChoiceId,
      hesitationBeforeStartMs: Math.max(0, hesitationBeforeStartMs),
      solvingDurationMs: Math.max(0, solvingDurationMs),
      answerChanges,
      pulse,
    });
    await loadNext();
  }

  if (loading && !question) {
    return <div className="app-shell">Loading…</div>;
  }
  if (!question || !question.item) return null;

  const item = question.item;

  return (
    <div className="assess-grid">
      <div className="card">
        <div className="top-bar">
          <span className="question-counter">
            Question {question.questionNumber} of ~{question.maxQuestions}
          </span>
          <button className="btn btn-ghost" onClick={() => setShowPanel((v) => !v)}>
            {showPanel ? "Hide" : "Show"} engine internals
          </button>
        </div>

        <div className="breadcrumb">{question.breadcrumb}</div>
        <div className="tag-row">
          <span className="tag tag-cpa">{item.cpa}</span>
          <span className="tag tag-bloom">{item.bloom}</span>
          {question.isReframe && <span className="tag tag-badge-reframe">Reframe · untimed</span>}
          {question.isProceduralCheck && <span className="tag tag-badge-procedural">Side-probe</span>}
        </div>

        <div className="prompt-text">{item.prompt}</div>

        {item.representation?.kind === "bar-model" && <BarModel spec={item.representation} />}
        {item.representation?.kind === "concrete" && <ConcreteObjects spec={item.representation} />}

        <div className="choices">
          {item.choices.map((choice) => (
            <button
              key={choice.id}
              className={`choice-btn ${selectedChoiceId === choice.id ? "selected" : ""}`}
              onClick={() => handleChoiceClick(choice.id)}
            >
              {choice.text}
            </button>
          ))}
        </div>

        <div className="footer-row">
          <PulseCheck value={pulse} onChange={setPulse} />
          <button className="btn btn-primary" disabled={!selectedChoiceId || loading} onClick={handleContinue}>
            Continue &rarr;
          </button>
        </div>
      </div>

      {showPanel && (
        <div className="card">
          <CPABloomGrid cells={question.grid ?? []} topicLabel={question.topicName ?? item.topicId} />
          <SessionMap entries={question.sessionMap ?? []} />
          <EngineTrace lines={question.engineTrace ?? []} />
        </div>
      )}
    </div>
  );
}
