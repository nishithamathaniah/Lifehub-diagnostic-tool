import { createClient } from "@libsql/client/web";

// `@libsql/client/web` is the pure HTTP/WebSocket build — no native binary,
// unlike the default Node build (which statically pulls in the native
// `libsql` package for local-file support and can fail to load inside
// Vercel's serverless runtime even when unused at runtime). It only talks
// to a remote Turso database, so both local dev and production point at
// the same one — see README "Deploying to Vercel" for how to create it.
const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url || !authToken) {
  throw new Error(
    "TURSO_DATABASE_URL and TURSO_AUTH_TOKEN must be set — see README's " +
      "'Deploying to Vercel' section. For local dev, put them in server/.env."
  );
}

export const db = createClient({ url, authToken });

const SCHEMA = `
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  child_name TEXT NOT NULL,
  grade TEXT NOT NULL,
  created_at TEXT NOT NULL,
  status TEXT NOT NULL,
  state TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS responses (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  seq INTEGER NOT NULL,
  topic_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  cpa TEXT NOT NULL,
  bloom TEXT NOT NULL,
  subskill TEXT NOT NULL,
  choice_id TEXT NOT NULL,
  correct INTEGER NOT NULL,
  hesitation_before_start_ms INTEGER NOT NULL,
  solving_duration_ms INTEGER NOT NULL,
  answer_changes INTEGER NOT NULL DEFAULT 0,
  pulse TEXT,
  is_reframe INTEGER NOT NULL DEFAULT 0,
  reframe_of_seq INTEGER,
  is_procedural_check INTEGER NOT NULL DEFAULT 0,
  outcome TEXT,
  FOREIGN KEY (session_id) REFERENCES sessions(id)
);

CREATE INDEX IF NOT EXISTS idx_responses_session ON responses(session_id);
`;

// Serverless cold starts hit this on every fresh instance, so the migration
// itself must be idempotent (CREATE TABLE/INDEX IF NOT EXISTS) and its result
// memoized per-instance so warm invocations don't re-run it.
let migrated: Promise<void> | null = null;

export function ensureMigrated(): Promise<void> {
  if (!migrated) {
    migrated = db.executeMultiple(SCHEMA);
  }
  return migrated;
}
