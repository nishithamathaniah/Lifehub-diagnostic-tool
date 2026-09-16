import "dotenv/config";
import { app } from "./app.js";

// Local dev / non-serverless entry point. On Vercel, `api/index.ts` imports
// `app` directly and never runs this file (Vercel injects env vars itself,
// so dotenv is only needed here). Reads TURSO_DATABASE_URL / TURSO_AUTH_TOKEN
// from server/.env — see server/.env.example.
const PORT = process.env.PORT ? Number(process.env.PORT) : 4001;
app.listen(PORT, () => {
  console.log(`LifeHub diagnostic server listening on http://localhost:${PORT}`);
});
