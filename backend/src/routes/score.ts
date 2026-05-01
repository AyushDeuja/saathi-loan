import { Router } from "express";
import { Connection, PublicKey } from "@solana/web3.js";
import { computeRiskScore } from "../services/riskScore.js";

export const scoreRouter = Router();
const SCORE_CACHE_TTL_MS = 60_000;
const scoreCache = new Map<string, { expiresAt: number; payload: unknown }>();

function isValidPublicKey(value: string): boolean {
  try {
    new PublicKey(value);
    return true;
  } catch {
    return false;
  }
}

scoreRouter.get("/:walletAddress", async (req, res) => {
  const { walletAddress } = req.params;

  if (!isValidPublicKey(walletAddress)) {
    return res.status(400).json({ error: "Invalid Solana wallet address" });
  }

  const rpcUrl = process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
  const connection = new Connection(rpcUrl, "confirmed");
  const cached = scoreCache.get(walletAddress);

  if (cached && cached.expiresAt > Date.now()) {
    return res.json(cached.payload);
  }

  try {
    const scoreResult = await computeRiskScore(walletAddress, connection);
    scoreCache.set(walletAddress, {
      expiresAt: Date.now() + SCORE_CACHE_TTL_MS,
      payload: scoreResult,
    });
    return res.json(scoreResult);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown RPC error";
    return res
      .status(500)
      .json({ error: "Failed to compute risk score", details: message });
  }
});
