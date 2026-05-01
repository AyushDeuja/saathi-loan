import { Router } from "express";
import { Connection, PublicKey } from "@solana/web3.js";
import { z } from "zod";
import {
  createLoanRecord,
  getLoansForWallet,
} from "../services/loanService.js";
import { getRecentLoans } from "../services/loanService.js";
import { computeRiskScore } from "../services/riskScore.js";
import { getPoolStats } from "../services/poolService.js";

export const loanRouter = Router();
const POOL_STATS_CACHE_TTL_MS = 15_000;
let poolStatsCache:
  | {
      expiresAt: number;
      payload: Awaited<ReturnType<typeof getPoolStats>>;
    }
  | null = null;

const loanRequestSchema = z.object({
  walletAddress: z.string().refine(
    (value) => {
      try {
        new PublicKey(value);
        return true;
      } catch {
        return false;
      }
    },
    { message: "walletAddress must be a valid Solana public key" }
  ),
  loanAmountLamports: z
    .number({ invalid_type_error: "loanAmountLamports must be a number" })
    .int()
    .positive(),
  durationDays: z
    .number({ invalid_type_error: "durationDays must be a number" })
    .int()
    .positive(),
});

function isValidPublicKey(value: string): boolean {
  try {
    new PublicKey(value);
    return true;
  } catch {
    return false;
  }
}

loanRouter.post("/request", async (req, res) => {
  const parsed = loanRequestSchema.safeParse(req.body);

  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: "Invalid request body", details: parsed.error.flatten() });
  }

  const { walletAddress, loanAmountLamports, durationDays } = parsed.data;
  const rpcUrl = process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
  const connection = new Connection(rpcUrl, "confirmed");

  try {
    const scoreResult = await computeRiskScore(walletAddress, connection);

    if (!scoreResult.terms.approved) {
      return res.status(403).json({
        error:
          "Loan request rejected: wallet did not meet the minimum risk score",
        scoreResult,
      });
    }

    if (durationDays > scoreResult.terms.maxDurationDays) {
      return res.status(400).json({
        error: `durationDays exceeds maximum allowed (${scoreResult.terms.maxDurationDays})`,
      });
    }

    const collateralRequired = Math.ceil(
      loanAmountLamports / scoreResult.terms.ltv
    );
    const interestLamports = Math.ceil(
      (loanAmountLamports * scoreResult.terms.interestRateBps) / 10000
    );
    const dueTimestamp = Math.floor(Date.now() / 1000) + durationDays * 86400;

    const createdLoan = await createLoanRecord({
      walletAddress,
      loanAmountLamports,
      collateralAmountLamports: collateralRequired,
      interestBps: scoreResult.terms.interestRateBps,
      durationDays,
      dueTimestamp,
      riskScore: scoreResult.score,
    });

    return res.status(201).json({
      loanId: createdLoan.id,
      collateralRequired,
      interestLamports,
      dueTimestamp,
      terms: scoreResult.terms,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown backend error";
    return res
      .status(500)
      .json({ error: "Failed to process loan request", details: message });
  }
});

// Return last 10 loans across all wallets
loanRouter.get("/all", async (_req, res) => {
  try {
    const loans = await getRecentLoans(10);
    return res.json({ loans });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown backend error";
    return res
      .status(500)
      .json({ error: "Failed to fetch recent loans", details: message });
  }
});

// Pool stats (reads on-chain)
loanRouter.get("/pool/stats", async (_req, res) => {
  if (poolStatsCache && poolStatsCache.expiresAt > Date.now()) {
    return res.json(poolStatsCache.payload);
  }

  try {
    const stats = await getPoolStats();
    poolStatsCache = {
      expiresAt: Date.now() + POOL_STATS_CACHE_TTL_MS,
      payload: stats,
    };
    return res.json(stats);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown backend error";
    return res
      .status(500)
      .json({ error: "Failed to read pool stats", details: message });
  }
});

loanRouter.get("/:walletAddress", async (req, res) => {
  const { walletAddress } = req.params;

  if (!isValidPublicKey(walletAddress)) {
    return res.status(400).json({ error: "Invalid Solana wallet address" });
  }

  try {
    const loans = await getLoansForWallet(walletAddress);
    return res.json({ walletAddress, loans });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown backend error";
    return res
      .status(500)
      .json({ error: "Failed to fetch loans", details: message });
  }
});

// Log a deposit intent (optional logging only)
loanRouter.post("/pool/deposit", async (req, res) => {
  const bodySchema = z.object({
    walletAddress: z.string().refine((v) => {
      try {
        new PublicKey(v);
        return true;
      } catch {
        return false;
      }
    }),
    amountLamports: z.union([z.bigint(), z.number()]),
  });

  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: "Invalid body", details: parsed.error.flatten() });
  }

  const { walletAddress, amountLamports } = parsed.data;
  // For now just log the deposit intent. Actual deposit happens on-chain via the deposit_pool instruction.
  console.log(`Deposit intent logged: ${walletAddress} -> ${amountLamports}`);

  return res.status(201).json({ message: "Deposit logged" });
});
