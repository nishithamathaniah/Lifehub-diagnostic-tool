import { app } from "./app.js";

// Local dev / non-serverless entry point. On Vercel, `api/index.ts` imports
// `app` directly and never runs this file.
const PORT = process.env.PORT ? Number(process.env.PORT) : 4001;
app.listen(PORT, () => {
  console.log(`LifeHub diagnostic server listening on http://localhost:${PORT}`);
});
