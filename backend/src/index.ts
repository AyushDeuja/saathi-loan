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
const rootEnv = dotenv.config({ path: rootEnvPath });
if (rootEnv.error) {
  dotenv.config();
}
const backendEnvPath = path.join(__dirname, "..", ".env");
dotenv.config({ path: backendEnvPath, override: true });

function resolveListenPort(): number {
  if (process.env.BACKEND_PORT) {
    return Number(process.env.BACKEND_PORT);
  }
  const fromEnv = process.env.PORT ? Number(process.env.PORT) : undefined;
  // Root .env often sets PORT=3000 for Next.js; avoid binding the API on the same port locally.
  if (
    fromEnv === 3000 &&
    process.env.NODE_ENV !== "production"
  ) {
    return 4000;
  }
  return fromEnv ?? 4000;
}

const app = express();
const port = resolveListenPort();
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
