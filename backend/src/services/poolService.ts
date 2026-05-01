import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { PublicKey, Connection } from "@solana/web3.js";
import { BorshCoder, type Idl } from "@coral-xyz/anchor";
import { withRpcRetry } from "./rpcUtils.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..", "..", "..");
const IDL_PATH = path.join(repoRoot, "anchor/target/idl/vault.json");

type IdlWithMeta = Idl & { metadata?: { address?: string } };
type PoolAccountData = {
  totalDeposited?: bigint | { toString: () => string };
  totalLoaned?: bigint | { toString: () => string };
  totalInterestEarned?: bigint | { toString: () => string };
  total_deposited?: bigint | { toString: () => string };
  total_loaned?: bigint | { toString: () => string };
  total_interest_earned?: bigint | { toString: () => string };
};

function asBigInt(
  value: bigint | { toString: () => string } | undefined
): bigint {
  if (typeof value === "bigint") {
    return value;
  }
  if (value && typeof value.toString === "function") {
    return BigInt(value.toString());
  }
  return 0n;
}

export async function getPoolStats(): Promise<{
  totalDeposited: string;
  totalLoaned: string;
  totalInterestEarned: string;
  availableLiquidity: string;
  apyEstimatePercent: number | null;
}> {
  if (!fs.existsSync(IDL_PATH)) {
    throw new Error(`IDL not found at ${IDL_PATH}`);
  }

  const raw = fs.readFileSync(IDL_PATH, "utf8");
  const idl = JSON.parse(raw) as IdlWithMeta;

  const idlAddress = idl.metadata?.address ?? idl.address ?? null;
  const programIdString = process.env.PROGRAM_ID ?? idlAddress;
  if (!programIdString) {
    throw new Error("PROGRAM_ID not set in env and missing in IDL metadata");
  }
  const programId = new PublicKey(programIdString);

  const rpcUrl = process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
  const connection = new Connection(rpcUrl, "confirmed");

  const [poolPda] = await PublicKey.findProgramAddress(
    [Buffer.from("pool")],
    programId
  );

  const accountInfo = await withRpcRetry(
    () => connection.getAccountInfo(poolPda, "confirmed"),
    "getAccountInfo(pool)"
  );
  if (!accountInfo) {
    return {
      totalDeposited: "0",
      totalLoaned: "0",
      totalInterestEarned: "0",
      availableLiquidity: "0",
      apyEstimatePercent: null,
    };
  }

  const coder = new BorshCoder(idl as Idl);
  const decoded = coder.accounts.decode(
    "PoolAccount",
    accountInfo.data
  ) as PoolAccountData;

  const totalDeposited = asBigInt(
    decoded.totalDeposited ?? decoded.total_deposited
  );
  const totalLoaned = asBigInt(decoded.totalLoaned ?? decoded.total_loaned);
  const totalInterestEarned = asBigInt(
    decoded.totalInterestEarned ?? decoded.total_interest_earned
  );

  const available = totalDeposited - totalLoaned;

  // APY estimate: use env POOL_LAUNCH_TS (unix seconds) or fallback 7 days
  const launchTs = process.env.POOL_LAUNCH_TS
    ? Number(process.env.POOL_LAUNCH_TS)
    : Math.floor(Date.now() / 1000) - 7 * 86400;
  const daysSinceLaunch = Math.max(
    1,
    Math.floor((Date.now() / 1000 - launchTs) / 86400)
  );
  let apy: number | null = null;
  if (Number(totalDeposited) > 0) {
    apy =
      (Number(totalInterestEarned) / Number(totalDeposited)) *
      (365 / daysSinceLaunch) *
      100;
  }

  return {
    totalDeposited: totalDeposited.toString(),
    totalLoaned: totalLoaned.toString(),
    totalInterestEarned: totalInterestEarned.toString(),
    availableLiquidity: available.toString(),
    apyEstimatePercent: apy === null ? null : Number(apy.toFixed(4)),
  };
}
