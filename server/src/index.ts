import express from "express";
import cors from "cors";
import { router } from "./routes.js";
import "./db.js";

const app = express();
app.use(cors());
app.use(express.json());
app.use("/api", router);

app.get("/api/health", (_req, res) => res.json({ ok: true }));

const PORT = process.env.PORT ? Number(process.env.PORT) : 4001;
app.listen(PORT, () => {
  console.log(`LifeHub diagnostic server listening on http://localhost:${PORT}`);
});
