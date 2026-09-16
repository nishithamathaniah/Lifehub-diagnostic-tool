import { getItemById } from "../src/itemBank/index.ts";

const BASE = "http://localhost:4001/api";

async function main() {
  const createRes = await fetch(`${BASE}/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ childName: "Aanya", grade: "Grade 5" }),
  });
  const { sessionId } = await createRes.json();
  console.log("session", sessionId);

  let n = 0;
  while (n < 60) {
    n++;
    const nq = await (await fetch(`${BASE}/sessions/${sessionId}/next-question`)).json();
    if (nq.done) {
      console.log("DONE after", n - 1, "questions");
      break;
    }
    const clientItem = nq.item;
    const real = getItemById(clientItem.id);

    // Simulated child profile:
    // - Aces Concrete and Abstract representations (fast, low hesitation).
    // - Struggles specifically on Pictorial word-problem-setup items (slow, hesitant, guesses).
    const isWeakSpot = real.cpa === "pictorial";
    const willBeCorrect = isWeakSpot ? Math.random() < 0.15 : Math.random() < 0.9;

    const choiceId = willBeCorrect
      ? real.correctChoiceId
      : real.choices.find((c) => c.id !== real.correctChoiceId).id;

    const body = {
      choiceId,
      hesitationBeforeStartMs: willBeCorrect ? 1200 : (isWeakSpot ? 9500 : 3000),
      solvingDurationMs: 4000,
      answerChanges: willBeCorrect ? 0 : 2,
      pulse: willBeCorrect ? "easy" : "hard",
    };
    const ans = await (await fetch(`${BASE}/sessions/${sessionId}/answer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })).json();
    console.log(n, real.topicId, real.cpa, real.bloom, nq.isReframe ? "[REFRAME]" : "", nq.isProceduralCheck ? "[PROCEDURAL]" : "", "-> correct=", ans.correct, "outcome=", ans.outcome);
  }

  const report = await (await fetch(`${BASE}/sessions/${sessionId}/report`)).json();
  console.log("\n=== REPORT ===\n", JSON.stringify(report, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
