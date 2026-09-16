# LifeHub Foundations — Dynamic Math Diagnostic (Pilot Build)

A working, full-stack implementation of the diagnostic described in
`LifeHub_Foundations_-_Math_Diagnostic_Design_Document.pdf`: an adaptive
Grade 5 (Singapore Math) assessment that walks a CPA × Bloom's grid per
topic and cross-references correctness with behavioural timing signals to
tag each topic as **Mastered**, **Skill gap**, **Procedural, not
conceptual**, or **Anxiety-flagged** — instead of a single score.

This build covers the two pilot topics the design doc itself recommends
starting with (Section 10, "Suggested immediate next step"): **Fractions
and Division** and **Four Operations of Fractions**.

## Stack

- **Server**: Node.js + TypeScript + Express, SQLite (`better-sqlite3`) for
  persistence — sessions and every response are stored, not just held in
  memory.
- **Client**: React + TypeScript (Vite).
- No auth — this is a pilot/demo build, not a deployment-ready product (see
  *Open questions* below, carried over from the design doc).

## Running it

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
strong everywhere else, to exercise the climb/drop/reframe/procedural-check
logic and print the resulting report:

```bash
cd server && npm run dev &     # needs the server running
npm run simulate
```

## How the design doc maps to this codebase

| Design doc concept | Where it lives |
|---|---|
| Skill Engine (climb/drop/mastery gate) | `server/src/engine/skillEngine.ts` |
| Signal Engine (hesitation/latency classification) | `server/src/engine/signalEngine.ts` |
| Synthesis layer → diagnosis tags + report | `server/src/engine/synthesis.ts` |
| CPA × Bloom's item bank | `server/src/itemBank/*` |
| Per-topic mastery loop (climb/drop/reframe) | `applyOutcome()` in `skillEngine.ts` |
| Prerequisite graph | `dependsOn` on each `Topic` in `itemBank/topics.ts` |
| Screen 1 (assessment + side panel) | `client/src/screens/Assessment.tsx` |
| Screen 2 (diagnostic report) | `client/src/screens/Report.tsx` |
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
reframe-probe / procedural-check machinery instead of looping.

### The "procedural, not conceptual" mechanism

Section 04's central example — a child who computes correctly in Abstract
but can't represent the same relationship Pictorially — can't emerge from
pure forward climbing (Pictorial is always cleared before Abstract is ever
attempted). To make this diagnosable, the engine runs a one-time **Abstract
side-probe** on the exact struggled-on relationship after a topic's second
struggle. A correct answer there — computing symbolically what it just
failed to represent visually — is the procedural-without-conceptual
signature; the report's evidence line for that tag comes directly from
this probe plus the recorded per-representation accuracy.

## Known simplifications (pilot scope, matching the doc's own open questions)

- **Item bank depth**: 1 authored item per CPA×Bloom cell (15 per topic, 30
  total) rather than the multiple-items-per-cell the doc flags as an open
  statistical-confidence question (Section 10). The engine falls back
  gracefully but a revisited cell currently repeats its one item.
- **Lag threshold**: hard-coded at 5 consecutive struggles
  (`LAG_THRESHOLD` in `skillEngine.ts`), exactly the doc's "starting
  assumption, not a validated number."
- **Reframe delay**: fixed at 5 questions later, not the more sophisticated
  scheduling the doc calls for.
- **No auth, no multi-session history, no teacher/remediation-system
  integration** — all flagged as unresolved in Section 10.
- Only 2 of the 12 Grade 5 topics are implemented; the report's other two
  strand pyramids render as "Not yet assessed in this pilot."

## Project layout

```
server/
  src/
    itemBank/       topics + authored items for the 2 pilot topics
    engine/         state, skillEngine, signalEngine, synthesis, view
    db.ts           SQLite schema
    sessionStore.ts persistence layer
    routes.ts       REST API
  scripts/simulate.ts
client/
  src/
    screens/        Setup, Assessment, Report
    components/      BarModel, ConcreteObjects, CPABloomGrid, SessionMap,
                     EngineTrace, PulseCheck, BloomPyramid
    styles/theme.css
```
