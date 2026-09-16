/**
 * Signal Engine — passive. It never decides what to ask; it only reads timing
 * and interaction metadata off a response and turns it into behavioural flags
 * that the Skill Engine and the synthesis layer consume.
 *
 * Timings arrive as client-measured durations (not absolute timestamps) so the
 * classification never depends on client/server clock sync.
 */

export interface RawTiming {
  hesitationBeforeStartMs: number; // time from question shown to first interaction
  solvingDurationMs: number; // time from first interaction to submit
  answerChanges: number;
}

export interface SignalReading {
  hesitationBeforeStartMs: number;
  solvingDurationMs: number;
  longPauseBeforeStart: boolean; // avoidance-shaped: stalling before engaging at all
  quickGuess: boolean; // suspiciously fast full response — escape behaviour
  manyAnswerChanges: boolean;
  lowHesitation: boolean; // the "cleared with low hesitation" gate the mastery loop checks
}

const LONG_PAUSE_BEFORE_START_MS = 7000;
const QUICK_GUESS_TOTAL_MS = 2000;
const MANY_ANSWER_CHANGES = 2;

export function readSignal(t: RawTiming): SignalReading {
  const totalMs = t.hesitationBeforeStartMs + t.solvingDurationMs;
  const longPauseBeforeStart = t.hesitationBeforeStartMs >= LONG_PAUSE_BEFORE_START_MS;
  const quickGuess = totalMs <= QUICK_GUESS_TOTAL_MS;
  const manyAnswerChanges = t.answerChanges >= MANY_ANSWER_CHANGES;

  const lowHesitation = !longPauseBeforeStart && !manyAnswerChanges;

  return {
    hesitationBeforeStartMs: t.hesitationBeforeStartMs,
    solvingDurationMs: t.solvingDurationMs,
    longPauseBeforeStart,
    quickGuess,
    manyAnswerChanges,
    lowHesitation,
  };
}
