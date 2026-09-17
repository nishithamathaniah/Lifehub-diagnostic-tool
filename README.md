# LifeHub Foundations — Dynamic Math Diagnostic (Pilot Build)

A working, full-stack implementation of the diagnostic described in
`LifeHub_Foundations_-_Math_Diagnostic_Design_Document.pdf`: an adaptive
Grade 5 (Singapore Math) assessment that walks a CPA × Bloom's grid per
topic to tag each topic as **Mastered**, **Skill gap**, or **Procedural,
not conceptual** — instead of a single score — plus a separate,
standalone math-anxiety self-report questionnaire.

This build covers the two pilot topics the design doc itself recommends
starting with (Section 10, "Suggested immediate next step"): **Fractions
and Division** and **Four Operations of Fractions**.

**Methodology note (read this before the rest):** the original design doc
proposed detecting anxiety *live, from within the math questions*, via a
"reframe probe" (silently re-presenting a struggled question later under
lower-stakes framing) and a raw hesitation-timing threshold. Neither is
backed by the actual published research: response-time as an anxiety
signal is inconsistent across studies, no validated millisecond threshold
exists anywhere in the literature, and there is no published protocol for
inferring anxiety live, item-by-item, from behaviour during a skill test.
This build has since moved to what the actual literature does instead:
**two separate instruments** — the adaptive skill test below, and a
standalone self-report questionnaire (wording adapted from the **Scale for
Early Mathematics Anxiety, SEMA** — validated for grades 3–6), reported
side by side rather than combined into one live signal. See *Two separate
instruments* below for the full reasoning and sourcing.

## Stack

- **Server**: Node.js + TypeScript + Express, persisted via
  [Turso](https://turso.tech) (libSQL — SQLite-compatible, accessible over
  the network) using `@libsql/client/web`, the pure HTTP/WebSocket build
  with no native binary. Local dev and production both talk to the same
  Turso database — a serverless function has no persistent local disk to
  keep a session's data alive between requests, so there's no local-only
  fallback (see *Deploying to Vercel* below for how to create the free-tier
  database both need).
- **Client**: React + TypeScript (Vite).
- No auth — this is a pilot/demo build, not a deployment-ready product (see
  *Open questions* below, carried over from the design doc).

## Running it

Needs a Turso database first (see *Deploying to Vercel* below for how to
create the free one) — copy `server/.env.example` to `server/.env` and fill
in `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN`.

```bash
npm install          # installs both workspaces

# terminal 1
npm run dev:server   # http://localhost:4001

# terminal 2
npm run dev:client   # http://localhost:5173 (proxies /api to the server)
```

Open `http://localhost:5173`, enter a child's name, and take the
assessment. Toggle **"Hide engine internals"** on the assessment screen to
see the interface the way a child would (the CPA×Bloom grid, session map,
and engine trace are reviewer-only per the design doc's Screen 1
annotations — they are not meant for the child-facing production build).

### Simulating a full session without clicking through the UI

`server/scripts/simulate.ts` drives the API end-to-end with a scripted
"child" that's deliberately weak on Pictorial word-problem items and
strong everywhere else, to exercise the climb/drop/procedural-check logic
and print the resulting report (it doesn't cover the separate anxiety
questionnaire, which isn't adaptive):

```bash
cd server && npm run dev &     # needs the server running
npm run simulate
```

## Deploying to Vercel (free tier)

The server is a single Express app exported for Vercel's Node runtime
(`server/api/index.ts`), with `server/vercel.json` rewriting every request
to it. To deploy the `server/` directory as its own Vercel project:

1. **Create a free Turso database** — install the Turso CLI or use
   [turso.tech](https://turso.tech) to sign up (free tier), then:
   ```bash
   turso db create lifehub-diagnostic
   turso db show lifehub-diagnostic --url        # → TURSO_DATABASE_URL
   turso db tokens create lifehub-diagnostic       # → TURSO_AUTH_TOKEN
   ```
2. In the Vercel project's **Settings → Environment Variables**, add
   `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` with the values from step 1.
3. Set the project's **Root Directory** to `server` (if not already).
4. Redeploy. The schema migration runs automatically on first request —
   no separate migration step needed.

Without those two env vars set, the server throws immediately on cold
start (`db.ts` requires them) rather than silently falling back to
something that would break just as badly — a serverless function's
filesystem is read-only outside `/tmp` and isn't shared across
invocations, so there's nowhere durable to put a local SQLite file anyway.

Two separate things were causing `FUNCTION_INVOCATION_FAILED` on the first
deploy attempts, in order: (1) `better-sqlite3` is a native addon that
isn't guaranteed to load in Vercel's runtime, and (2) even `@libsql/client`'s
*default* Node build statically pulls in a native `libsql` binary for its
local-file support — which can fail to load the same way even when only
used for a remote connection. Using `@libsql/client/web` (a pure
HTTP/WebSocket build with no native code at all) removes that risk
entirely — see `server/src/db.ts`.

The client (`client/`) deploys as a normal static Vite app on its own
Vercel project (or any static host). Set its `VITE_API_BASE_URL` env var
to the deployed server's URL plus `/api` (see `client/.env.example`) —
without it, the client calls a relative `/api` path that only resolves
correctly in local dev, where Vite's proxy handles it.

## How the design doc maps to this codebase

| Design doc concept | Where it lives |
|---|---|
| Skill Engine (climb/drop/mastery gate) | `server/src/engine/skillEngine.ts` |
| Synthesis layer → diagnosis tags + report | `server/src/engine/synthesis.ts` |
| CPA × Bloom's item bank | `server/src/itemBank/*` |
| Per-topic mastery loop (climb/drop) | `applyOutcome()` in `skillEngine.ts` |
| Prerequisite graph | `dependsOn` on each `Topic` in `itemBank/topics.ts` |
| Anxiety questionnaire (replaces the doc's live "reframe probe") | `server/src/itemBank/anxietyQuestionnaire.ts` |
| Screen 1 (assessment + side panel) | `client/src/screens/Assessment.tsx` |
| Screen 2 (diagnostic report) | `client/src/screens/Report.tsx` |
| Anxiety questionnaire screen | `client/src/screens/AnxietyCheck.tsx` |
| Palette / typography | `client/src/styles/theme.css` |

### A deliberate engine refinement beyond the doc's flowchart

The design doc's Section 05 flowchart tracks a single "current cell" per
topic and resets its struggle counter whenever *any* question clears. In
practice that lets the engine oscillate forever between a hard cell and
its easier back-probes without ever reaching a lag point — which defeats
the diagnostic's central case (a persistent, specific weak spot). This
build instead tracks a **frontier cell** (the real target the child must
prove they've cleared) separately from the **probe cell** (whatever's
being asked right now, which may sit below the frontier during
scaffolding). The struggle count only resets when the *frontier* itself
clears, so a genuinely stuck child reliably reaches the lag-point /
procedural-check machinery instead of looping. Progress is also gated on
**correctness alone**, not correctness *and* speed — real usage showed a
correct-but-thoughtful answer being treated as a struggle, which could
stall a topic indefinitely even when the child knew the material.

### The "procedural, not conceptual" mechanism

Section 04's central example — a child who computes correctly in Abstract
but can't represent the same relationship Pictorially — can't emerge from
pure forward climbing (Pictorial is always cleared before Abstract is ever
attempted). To make this diagnosable, the engine runs a one-time **Abstract
side-probe** on the exact struggled-on relationship after a topic's second
struggle. A correct answer there — computing symbolically what it just
failed to represent visually — is the procedural-without-conceptual
signature; the report's evidence line for that tag comes directly from
this probe plus the recorded per-representation accuracy. This mechanism
stayed unchanged through the anxiety-methodology rework below — it's
testing a CPA-representation gap (Singapore Math's own pedagogy), not an
anxiety signal, so it didn't need the same scrutiny.

## Two separate instruments, not one combined signal

**What changed, and why.** The design doc's original mechanism for
detecting anxiety was to watch behaviour *during* the math questions
themselves: a raw hesitation-timing threshold (a specific number of
seconds of "long pause" counted as an anxiety signal), and a "reframe
probe" that silently re-presented a struggled question later under
lower-stakes framing, checking whether performance recovered. Real usage
surfaced two problems with this:

1. **The timing threshold had no basis.** It was invented during
   implementation because the design doc doesn't specify one — and a web
   search of the actual published research (see sources below) found the
   relationship between response time and math anxiety is inconsistent
   across studies (some find anxious students respond slower; at least one
   finds anxiety affects accuracy but not response time at all). There is
   no validated millisecond cutoff anywhere in the literature.
2. **The reframe probe isn't a validated protocol.** The real, validated
   instruments for measuring math anxiety in children (AMAS, SEMA, MASC)
   are all short **self-report questionnaires**, administered as their own
   separate instrument — never interleaved live with a skill test the way
   this doc proposed. There's also a real methodological problem with
   same-session repetition specifically: a child who recognizes "this is
   the question I got wrong before" may feel *more* pressure, not less,
   and a recovered answer could just as easily reflect a practice effect
   (having seen the problem once already) as reduced anxiety — the design
   can't distinguish those.

**What this build does now.** Two genuinely separate instruments, matching
how the actual research does it:

- The **skill assessment** (unchanged in its CPA×Bloom mechanics) produces
  Mastered / Skill gap / Procedural-not-conceptual per topic, from
  correctness and representation-switching alone — no anxiety inference
  mixed in.
- A **standalone anxiety questionnaire** (`AnxietyCheck.tsx`,
  `anxietyQuestionnaire.ts`) runs afterward, as its own screen: 8 short
  items adapted from SEMA's two-factor structure (Numerical Processing
  anxiety — worry about the math itself; Situational/Performance anxiety —
  worry about being tested or watched), each answered on a simple 3-point
  scale. It is scored independently and shown in its own report section,
  explicitly *not* combined into the topic tags.

**Honesty about what's still approximate.** The SEMA-adapted wording and
two-factor structure are a genuine adaptation of a published, validated
instrument — but the specific Low/Moderate/Elevated scoring bands in
`synthesis.ts`'s `computeMathAnxiety()` are this build's own reasonable
split of the score range, not official published SEMA cutoffs (we
couldn't access the original scoring manual). Treat the level as a useful
read, not a clinical cutoff, until it can be validated against real pilot
data — which is exactly the kind of piloting Section 10 of the design doc
calls for.

Sources consulted for this change:
- [The Early Elementary School Abbreviated Math Anxiety Scale (EES-AMAS)](https://pmc.ncbi.nlm.nih.gov/articles/PMC7253683/)
- [Assessing math anxiety in elementary schoolchildren via SEMA](https://journals.plos.org/plosone/article?id=10.1371%2Fjournal.pone.0255777)
- [Math anxiety in elementary students: timing and task complexity](https://www.sciencedirect.com/science/article/abs/pii/S0022440524000360)
- [Time on Their Side: visual timers and anticipatory anxiety](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC12731990/)
- [Distinguishing math learning and evaluation anxiety (competing theoretical models)](https://pmc.ncbi.nlm.nih.gov/articles/PMC13326596/)

## Known simplifications (pilot scope, matching the doc's own open questions)

- **Item bank depth**: 1 authored item per CPA×Bloom cell (15 per topic, 30
  total) rather than the multiple-items-per-cell the doc flags as an open
  statistical-confidence question (Section 10). The engine falls back
  gracefully but a revisited cell currently repeats its one item.
- **Lag threshold**: hard-coded at 4 consecutive struggles
  (`LAG_THRESHOLD` in `skillEngine.ts`), still just a starting assumption,
  not a validated number — needs real piloting.
- **Anxiety scoring bands**: our own approximation, not official SEMA
  norms — see *Two separate instruments* above.
- **No auth, no multi-session history, no teacher/remediation-system
  integration** — all flagged as unresolved in Section 10.
- Only 2 of the 12 Grade 5 topics are implemented; the report's other two
  strand pyramids render as "Not yet assessed in this pilot."

## Project layout

```
server/
  api/index.ts      Vercel serverless entry point (exports the Express app)
  vercel.json        rewrites every request to api/index.ts
  src/
    itemBank/       topics + skill items + anxietyQuestionnaire.ts
    engine/         state, skillEngine, signalEngine (raw timing only), synthesis, view
    db.ts           Turso/libSQL client + schema migration
    sessionStore.ts persistence layer (async)
    app.ts          Express app (no .listen — shared by local + serverless)
    index.ts        local dev entry point (calls app.listen)
    routes.ts       REST API (skill assessment + separate anxiety-questionnaire endpoints)
  scripts/simulate.ts
client/
  src/
    screens/        Setup, Assessment, AnxietyCheck, Report
    components/      BarModel, ConcreteObjects, CPABloomGrid, SessionMap,
                     EngineTrace, PulseCheck, BloomPyramid, ChildSummary
    styles/theme.css
    api.ts          fetch layer (VITE_API_BASE_URL-aware)
```
