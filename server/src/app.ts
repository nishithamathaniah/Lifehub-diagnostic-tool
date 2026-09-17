import express from "express";
import cors from "cors";
import { router } from "./routes.js";
import { ensureMigrated } from "./db.js";

export const app = express();
app.use(cors());
app.use(express.json());

// Runs the (idempotent, memoized) schema migration before the first request
// on a given instance — necessary because a serverless cold start has no
// separate "startup" phase to run it in ahead of time.
app.use(async (_req, res, next) => {
  try {
    await ensureMigrated();
    next();
  } catch (err) {
    console.error("Migration failed", err);
    res.status(500).json({ error: "database unavailable" });
  }
});

app.use("/api", router);
app.get("/api/health", (_req, res) => res.json({ ok: true }));

// This is an API-only deployment — the child/parent-facing UI is the
// separate client app. A friendly landing message here just confirms the
// server is up, rather than leaving Express's default 404 at "/".
app.get("/", (_req, res) => res.json({ ok: true, service: "lifehub-diagnostic-tool-server", health: "/api/health" }));

// Also exported as default: if Vercel's Root Directory ends up pointing at
// the repo root instead of server/, its zero-config detection can end up
// invoking this file directly instead of api/index.ts, and it requires a
// default export shaped like a request handler.
export default app;
