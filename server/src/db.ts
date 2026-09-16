import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "..", "data");
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

export const db = new Database(path.join(dataDir, "lifehub.sqlite"));
db.pragma("journal_mode = WAL");

db.exec(`
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
`);
