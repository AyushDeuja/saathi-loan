import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { loanRouter } from "./routes/loan.js";
import { scoreRouter } from "./routes/score.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..", "..");
const rootEnvPath = path.join(repoRoot, ".env");
const rootEnv = dotenv.config({ path: rootEnvPath, override: true });
if (rootEnv.error) {
  dotenv.config({ override: true });
}

const app = express();
const port = Number(process.env.PORT ?? 4000);
const frontendUrl = process.env.FRONTEND_URL ?? "http://localhost:3000";

app.use(cors({ origin: frontendUrl }));
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/score", scoreRouter);
app.use("/loan", loanRouter);

app.listen(port, () => {
  console.log(`Backend listening on port ${port}`);
});
