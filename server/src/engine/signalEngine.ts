/**
 * Signal Engine — passive. It never decides what to ask, and (as of this
 * version) it no longer classifies timing into "anxious-looking" behavioural
 * flags either. There is no published, validated threshold for what counts
 * as a suspiciously long pause or a "quick guess" during a child's math
 * assessment — the literature on response-time and math anxiety is mixed
 * (some studies find anxious students respond slower, others find anxiety
 * affects accuracy but not response time at all), so inventing a specific
 * millisecond cutoff and treating it as a diagnostic signal isn't
 * defensible. See README for the switch to a separate, validated-style
 * self-report questionnaire (anxietyQuestionnaire.ts) as the actual anxiety
 * measure.
 *
 * This still records the raw timing per response — it's useful data for
 * future analysis once we have real pilot sessions — it just doesn't
 * classify or act on it.
 */

export interface RawTiming {
  hesitationBeforeStartMs: number; // time from question shown to first interaction
  solvingDurationMs: number; // time from first interaction to submit
  answerChanges: number;
}

export function readSignal(t: RawTiming): RawTiming {
  return {
    hesitationBeforeStartMs: Math.max(0, t.hesitationBeforeStartMs),
    solvingDurationMs: Math.max(0, t.solvingDurationMs),
    answerChanges: Math.max(0, t.answerChanges),
  };
}
