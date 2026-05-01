import fs from "fs";
import os from "os";
import path from "path";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import {
  AnchorProvider,
  Program,
  type Idl,
  type Wallet,
} from "@coral-xyz/anchor";
import { BN } from "bn.js";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  VersionedTransaction,
} from "@solana/web3.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..", "..");
const rootEnvPath = path.join(repoRoot, ".env");
const rootEnv = dotenv.config({ path: rootEnvPath });
if (rootEnv.error) {
  dotenv.config();
}

const IDL_PATH = path.join(repoRoot, "anchor/target/idl/vault.json");

function loadKeypair(): Keypair {
  const walletPath =
    process.env.ANCHOR_WALLET ??
    path.join(os.homedir(), ".config/solana/id.json");
  const secret = JSON.parse(fs.readFileSync(walletPath, "utf8"));
  return Keypair.fromSecretKey(Uint8Array.from(secret));
}

function makeKeypairWallet(payer: Keypair): Wallet {
  return {
    publicKey: payer.publicKey,
    async signTransaction(tx) {
      if (tx instanceof VersionedTransaction) {
        tx.sign([payer]);
      } else {
        tx.partialSign(payer);
      }
      return tx;
    },
    async signAllTransactions(txs) {
      return Promise.all(
        txs.map(async (tx) => {
          if (tx instanceof VersionedTransaction) {
            tx.sign([payer]);
          } else {
            tx.partialSign(payer);
          }
          return tx;
        })
      );
    },
  };
}

async function main() {
  if (!fs.existsSync(IDL_PATH)) {
    throw new Error(`IDL not found at ${IDL_PATH}`);
  }

  const idl = JSON.parse(fs.readFileSync(IDL_PATH, "utf8")) as Idl & {
    address?: string;
  };

  const programIdString = process.env.PROGRAM_ID ?? idl.address;
  if (!programIdString) {
    throw new Error("PROGRAM_ID not set in env and missing in IDL");
  }

  const programId = new PublicKey(programIdString);
  const rpcUrl = process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
  const connection = new Connection(rpcUrl, "confirmed");

  const payer = loadKeypair();
  const wallet = makeKeypairWallet(payer);
  const provider = new AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });

  const idlWithAddress: Idl = { ...idl, address: programId.toBase58() };
  const program = new Program(idlWithAddress, provider);

  const [poolPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("pool")],
    programId
  );

  const poolInfo = await connection.getAccountInfo(poolPda, "confirmed");
  if (!poolInfo) {
    console.log("Pool not initialized. Initializing...");
    await program.methods
      .initializePool()
      .accounts({
        authority: wallet.publicKey,
        pool: poolPda,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  }

  const airdropSol = Number(process.env.AIRDROP_SOL ?? "0");
  if (airdropSol > 0) {
    const sig = await connection.requestAirdrop(
      wallet.publicKey,
      Math.floor(airdropSol * 1e9)
    );
    const latest = await connection.getLatestBlockhash("confirmed");
    await connection.confirmTransaction({
      signature: sig,
      blockhash: latest.blockhash,
      lastValidBlockHeight: latest.lastValidBlockHeight,
    });
    console.log(`Airdropped ${airdropSol} SOL:`, sig);
  }

  const depositSol = Number(process.env.FUND_POOL_SOL ?? "1");
  if (!Number.isFinite(depositSol) || depositSol <= 0) {
    throw new Error("FUND_POOL_SOL must be a positive number");
  }

  const amountLamports = new BN(Math.floor(depositSol * 1e9));

  const signature = await program.methods
    .depositPool(amountLamports)
    .accounts({
      lender: wallet.publicKey,
      pool: poolPda,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  console.log(`Deposited ${depositSol} SOL. Signature:`, signature);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
