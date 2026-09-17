import { useEffect, useState } from "react";
import { getAnxietyQuestions, submitAnxietyAnswers } from "../api";
import { AnxietyQuestion } from "../types";

const OPTIONS: { score: number; emoji: string; label: string }[] = [
  { score: 1, emoji: "😊", label: "Not worried" },
  { score: 2, emoji: "😐", label: "A little worried" },
  { score: 3, emoji: "😟", label: "Very worried" },
];

export function AnxietyCheck({ sessionId, onComplete }: { sessionId: string; onComplete: () => void }) {
  const [questions, setQuestions] = useState<AnxietyQuestion[] | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    getAnxietyQuestions(sessionId).then(setQuestions);
  }, [sessionId]);

  if (!questions) return <div className="app-shell">Loading…</div>;

  const allAnswered = questions.every((q) => answers[q.id] !== undefined);

  async function handleSubmit() {
    setSubmitting(true);
    const responses = Object.entries(answers).map(([questionId, score]) => ({ questionId, score }));
    await submitAnxietyAnswers(sessionId, responses);
    onComplete();
  }

  return (
    <div className="anxiety-check">
      <h1 className="serif">One last thing — how does math make you feel?</h1>
      <p className="anxiety-intro">
        This is separate from the questions you just did — there are no right or wrong answers here. Just pick
        whatever feels true for you.
      </p>

      <div className="anxiety-list">
        {questions.map((q, i) => (
          <div className="anxiety-item" key={q.id}>
            <div className="anxiety-question">
              {i + 1}. {q.text}
            </div>
            <div className="anxiety-options">
              {OPTIONS.map((opt) => (
                <button
                  key={opt.score}
                  type="button"
                  className={`anxiety-option ${answers[q.id] === opt.score ? "selected" : ""}`}
                  onClick={() => setAnswers((a) => ({ ...a, [q.id]: opt.score }))}
                >
                  <span className="anxiety-emoji">{opt.emoji}</span>
                  <span>{opt.label}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <button className="btn btn-primary" disabled={!allAnswered || submitting} onClick={handleSubmit}>
        {submitting ? "Saving…" : "Finish →"}
      </button>
    </div>
  );
}
