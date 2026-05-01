import {
  type ConfirmedSignatureInfo,
  Connection,
  LAMPORTS_PER_SOL,
  PublicKey,
} from "@solana/web3.js";
import { prisma } from "../db/prisma.js";
import { withRpcRetry } from "./rpcUtils.js";

export type LoanTerms = {
  ltv: number;
  interestRateBps: number;
  maxDurationDays: number;
  approved: boolean;
};

export type RiskScoreResult = {
  score: number;
  breakdown: {
    walletAge: number;
    solBalance: number;
    txVolume: number;
    repaymentHistory: number;
    defiActivity: number;
  };
  terms: LoanTerms;
};

const KNOWN_DEFI_PROGRAM_IDS = [
  "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4",
  "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8",
  "9xQeWvG816bUx9EPf8n8LK7gN6fYwP4M37f74x8M3Yv",
  "SSwpkEEcbUqx4vtoEByFjSkhKdCT862DNVb52nZg1UZ",
  "whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc",
];
const DEFAULT_HISTORY_LIMIT = 300;
const LOCALNET_HISTORY_LIMIT = 60;
const DEFAULT_DEFI_INSPECTION_LIMIT = 100;
const LOCALNET_DEFI_INSPECTION_LIMIT = 20;
const LOCALNET_DEV_MIN_SCORE = 60;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function roundToTwo(value: number): number {
  return Math.round(value * 100) / 100;
}

function mapTerms(score: number): LoanTerms {
  if (score >= 80) {
    return {
      ltv: 0.8,
      interestRateBps: 500,
      maxDurationDays: 90,
      approved: true,
    };
  }

  if (score >= 60) {
    return {
      ltv: 0.65,
      interestRateBps: 1000,
      maxDurationDays: 60,
      approved: true,
    };
  }

  if (score >= 40) {
    return {
      ltv: 0.5,
      interestRateBps: 1800,
      maxDurationDays: 30,
      approved: true,
    };
  }

  if (score >= 20) {
    return {
      ltv: 0.35,
      interestRateBps: 2800,
      maxDurationDays: 14,
      approved: true,
    };
  }

  return { ltv: 0, interestRateBps: 0, maxDurationDays: 0, approved: false };
}

async function getSignatureHistory(
  wallet: PublicKey,
  connection: Connection,
  maxSignatures = 300
): Promise<{
  count: number;
  oldestBlockTime: number | null;
  signatures: string[];
}> {
  let before: string | undefined;
  let count = 0;
  let oldestBlockTime: number | null = null;
  const signatures: string[] = [];

  while (count < maxSignatures) {
    const limit = Math.min(1000, maxSignatures - count);
    const batch: ConfirmedSignatureInfo[] = await withRpcRetry(
      () =>
        connection.getSignaturesForAddress(wallet, { before, limit }, "confirmed"),
      "getSignaturesForAddress"
    );

    if (batch.length === 0) {
      break;
    }

    count += batch.length;
    signatures.push(...batch.map((signatureInfo) => signatureInfo.signature));

    for (let i = batch.length - 1; i >= 0; i -= 1) {
      const blockTime = batch[i].blockTime;

      if (typeof blockTime === "number") {
        oldestBlockTime = blockTime;
        break;
      }
    }

    if (batch.length < limit) {
      break;
    }

    before = batch[batch.length - 1].signature;
  }

  return { count, oldestBlockTime, signatures };
}

async function getDefiActivityScore(
  signatures: string[],
  connection: Connection,
  inspectionLimit = DEFAULT_DEFI_INSPECTION_LIMIT
): Promise<number> {
  if (signatures.length === 0) {
    return 0;
  }

  const inspectedSignatures = signatures.slice(0, inspectionLimit);
  let parsedTransactions: Awaited<ReturnType<Connection["getParsedTransactions"]>>;
  try {
    parsedTransactions = await withRpcRetry(
      () =>
        connection.getParsedTransactions(inspectedSignatures, {
          maxSupportedTransactionVersion: 0,
          commitment: "confirmed",
        }),
      "getParsedTransactions",
      2,
      250
    );
  } catch {
    // Keep score flow responsive; treat DeFi signal as unavailable instead of failing request.
    return 0;
  }

  const knownPrograms = new Set(KNOWN_DEFI_PROGRAM_IDS);
  const matchedPrograms = new Set<string>();

  for (const tx of parsedTransactions) {
    if (!tx) {
      continue;
    }

    for (const instruction of tx.transaction.message.instructions) {
      const maybeProgramId =
        "programId" in instruction && instruction.programId
          ? instruction.programId.toBase58()
          : null;

      if (maybeProgramId && knownPrograms.has(maybeProgramId)) {
        matchedPrograms.add(maybeProgramId);
      }
    }
  }

  return Math.min(matchedPrograms.size * 2, 10);
}

export async function computeRiskScore(
  walletAddress: string,
  connection: Connection
): Promise<RiskScoreResult> {
  const wallet = new PublicKey(walletAddress);
  const rpcEndpoint = connection.rpcEndpoint.toLowerCase();
  const isLocalRpc =
    rpcEndpoint.includes("127.0.0.1") || rpcEndpoint.includes("localhost");
  const historyLimit = isLocalRpc ? LOCALNET_HISTORY_LIMIT : DEFAULT_HISTORY_LIMIT;
  const defiInspectionLimit = isLocalRpc
    ? LOCALNET_DEFI_INSPECTION_LIMIT
    : DEFAULT_DEFI_INSPECTION_LIMIT;
  const history = await getSignatureHistory(wallet, connection, historyLimit);

  let walletAgeScore = 0;

  if (history.oldestBlockTime !== null) {
    const nowInSeconds = Math.floor(Date.now() / 1000);
    const ageInDays = Math.max(
      0,
      (nowInSeconds - history.oldestBlockTime) / 86400
    );
    walletAgeScore = Math.min((ageInDays / 365) * 20, 20);
  }

  const balanceLamports = await withRpcRetry(
    () => connection.getBalance(wallet, "confirmed"),
    "getBalance"
  );
  const balanceSol = balanceLamports / LAMPORTS_PER_SOL;
  const solBalanceScore = Math.min((balanceSol / 5) * 20, 20);

  const txVolumeScore = Math.min(
    (Math.log10(history.count + 1) / Math.log10(501)) * 20,
    20
  );

  let totalLoans = 0;
  let repaidLoans = 0;

  try {
    [totalLoans, repaidLoans] = await Promise.all([
      prisma.loan.count({ where: { walletAddress } }),
      prisma.loan.count({ where: { walletAddress, status: "REPAID" } }),
    ]);
  } catch {
    totalLoans = 0;
    repaidLoans = 0;
  }

  const repaymentHistoryScore =
    totalLoans === 0 ? 15 : clamp((repaidLoans / totalLoans) * 30, 0, 30);

  const defiActivityScore = isLocalRpc
    ? 0
    : await getDefiActivityScore(
        history.signatures,
        connection,
        defiInspectionLimit
      );

  const breakdown = {
    walletAge: roundToTwo(clamp(walletAgeScore, 0, 20)),
    solBalance: roundToTwo(clamp(solBalanceScore, 0, 20)),
    txVolume: roundToTwo(clamp(txVolumeScore, 0, 20)),
    repaymentHistory: roundToTwo(clamp(repaymentHistoryScore, 0, 30)),
    defiActivity: roundToTwo(clamp(defiActivityScore, 0, 10)),
  };

  const totalScore = clamp(
    Math.round(
      breakdown.walletAge +
        breakdown.solBalance +
        breakdown.txVolume +
        breakdown.repaymentHistory +
        breakdown.defiActivity
    ),
    0,
    100
  );

  const finalScore = isLocalRpc
    ? Math.max(totalScore, LOCALNET_DEV_MIN_SCORE)
    : totalScore;

  return {
    score: finalScore,
    breakdown,
    terms: mapTerms(finalScore),
  };
}
