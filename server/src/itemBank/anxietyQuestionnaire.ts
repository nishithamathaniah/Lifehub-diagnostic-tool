/**
 * A standalone math-anxiety self-report questionnaire, administered as its
 * own separate instrument after the skill assessment — NOT interleaved with
 * it. This is a deliberate design choice: the actual validated literature
 * (AMAS, SEMA, MASC) measures math anxiety via short self-report
 * questionnaires given on their own, then correlates the result with a
 * separate skill/performance measure afterward. There is no published,
 * validated protocol for inferring anxiety live from in-the-moment timing
 * signals during a skill test, so we don't invent one.
 *
 * Wording and the two-factor structure (Numerical Processing vs Situational/
 * Performance anxiety) are adapted from the Scale for Early Mathematics
 * Anxiety (SEMA), which is specifically validated for grades 3–6 — a direct
 * match for our Grade 5 audience. This is an adaptation, not a licensed
 * reproduction of the original instrument, and the response scale is
 * simplified to 3 points (matching the in-app pulse-check UI) rather than
 * SEMA's original scale. The scoring bands in synthesis.ts are our own
 * reasonable approximation, not official published SEMA norms — see README.
 */

export type AnxietyFactor = "numerical" | "situational";

export interface AnxietyQuestion {
  id: string;
  factor: AnxietyFactor;
  text: string;
}

export const ANXIETY_QUESTIONS: AnxietyQuestion[] = [
  // Numerical Processing Anxiety — worry about the math itself
  { id: "aq-1", factor: "numerical", text: "How do you feel when you have to add or subtract numbers in your head?" },
  { id: "aq-2", factor: "numerical", text: "How do you feel when you see a page full of math problems?" },
  { id: "aq-3", factor: "numerical", text: "How do you feel when you have to work with fractions?" },
  { id: "aq-4", factor: "numerical", text: "How do you feel when a math problem has lots of steps?" },

  // Situational / Performance Anxiety — worry about being tested or watched
  { id: "aq-5", factor: "situational", text: "How do you feel right before a math test?" },
  { id: "aq-6", factor: "situational", text: "How do you feel when a teacher asks you to solve a problem in front of the class?" },
  { id: "aq-7", factor: "situational", text: "How do you feel when someone checks your math homework?" },
  { id: "aq-8", factor: "situational", text: "How do you feel when you're not sure if your math answer is right?" },
];
