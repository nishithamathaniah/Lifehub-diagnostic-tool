import { app } from "../src/app.js";

// Vercel's Node runtime treats a default-exported Express app as a request
// handler directly — this file is the serverless function entry point.
// `vercel.json`'s rewrite sends every request here.
export default app;
