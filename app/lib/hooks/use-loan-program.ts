"use client";

import {
  getAddressEncoder,
  getBytesEncoder,
  getProgramDerivedAddress,
  type Address,
} from "@solana/kit";
import {
  fetchMaybeBorrowerProfile,
  findBorrowerProfilePda,
  findPoolPda,
  getCreateLoanInstructionAsync,
  getInitializePoolInstructionAsync,
  getRepayLoanInstructionAsync,
  VAULT_PROGRAM_ADDRESS,
} from "../../generated/vault";
import { useWallet } from "../wallet/context";
import { useSendTransaction } from "./use-send-transaction";
import { useSolanaClient } from "../solana-client-context";

type CreateLoanArgs = {
  loanAmountLamports: bigint;
  collateralAmountLamports: bigint;
  interestRateBps: number;
  durationDays: number;
};

type CreateLoanResult = {
  signature: string;
  loanPda: Address;
  collateralPda: Address;
  loanIndex: bigint;
};

const PROGRAM_ID =
  (process.env.NEXT_PUBLIC_PROGRAM_ID as Address | undefined) ??
  VAULT_PROGRAM_ADDRESS;

function toU64LeBytes(value: bigint): Uint8Array {
  const bytes = new Uint8Array(8);
  const view = new DataView(bytes.buffer);
  view.setBigUint64(0, value, true);
  return bytes;
}

async function deriveLoanPda(
  borrower: Address,
  loanIndex: bigint
): Promise<readonly [Address, number]> {
  return getProgramDerivedAddress({
    programAddress: PROGRAM_ID,
    seeds: [
      getBytesEncoder().encode(new Uint8Array([108, 111, 97, 110])),
      getAddressEncoder().encode(borrower),
      toU64LeBytes(loanIndex),
    ],
  });
}

async function deriveCollateralPda(
  borrower: Address,
  loanIndex: bigint
): Promise<readonly [Address, number]> {
  return getProgramDerivedAddress({
    programAddress: PROGRAM_ID,
    seeds: [
      getBytesEncoder().encode(
        new Uint8Array([99, 111, 108, 108, 97, 116, 101, 114, 97, 108])
      ),
      getAddressEncoder().encode(borrower),
      toU64LeBytes(loanIndex),
    ],
  });
}

export function useLoanProgram() {
  const { signer, wallet } = useWallet();
  const { send, isSending } = useSendTransaction();
  const client = useSolanaClient();

  const borrower = wallet?.account.address;

  async function getPoolBalance(): Promise<bigint> {
    const [poolPda] = await findPoolPda({ programAddress: PROGRAM_ID });
    const balance = await client.rpc.getBalance(poolPda).send();
    return balance.value;
  }

  async function depositPool(amountLamports: bigint | number): Promise<string> {
    if (!signer) throw new Error("Wallet not connected");
    const instruction = await (
      await import("../../generated/vault/instructions/depositPool")
    ).getDepositPoolInstructionAsync(
      {
        lender: signer,
        amount:
          typeof amountLamports === "bigint"
            ? amountLamports
            : BigInt(amountLamports),
      },
      { programAddress: PROGRAM_ID }
    );

    const signature = await send({ instructions: [instruction] });
    return signature;
  }

  async function getPoolStats(): Promise<{
    totalDeposited: string;
    totalLoaned: string;
    totalInterestEarned: string;
    availableLiquidity: string;
    apyEstimatePercent: number | null;
  }> {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/loan/pool/stats`
    );
    if (!res.ok) {
      let message = "Failed to fetch pool stats";
      try {
        const payload = (await res.json()) as { error?: string };
        if (payload.error) {
          message = payload.error;
        }
      } catch {
        // Ignore parse errors and keep fallback message.
      }
      throw new Error(message);
    }
    return res.json();
  }

  async function initializePool(): Promise<string> {
    if (!signer) throw new Error("Wallet not connected");
    const instruction = await getInitializePoolInstructionAsync(
      {
        authority: signer,
      },
      { programAddress: PROGRAM_ID }
    );
    return send({ instructions: [instruction] });
  }

  async function createLoan(args: CreateLoanArgs): Promise<CreateLoanResult> {
    if (!signer || !borrower) {
      throw new Error("Wallet not connected");
    }

    const [borrowerProfilePda] = await findBorrowerProfilePda(
      { borrower },
      { programAddress: PROGRAM_ID }
    );

    const maybeBorrowerProfile = await fetchMaybeBorrowerProfile(
      client.rpc,
      borrowerProfilePda
    );

    const loanIndex = maybeBorrowerProfile.exists
      ? maybeBorrowerProfile.data.loanIndex
      : 0n;

    const [loanPda] = await deriveLoanPda(borrower, loanIndex);
    const [collateralPda] = await deriveCollateralPda(borrower, loanIndex);

    const instruction = await getCreateLoanInstructionAsync(
      {
        borrower: signer,
        borrowerProfile: borrowerProfilePda,
        loanAccount: loanPda,
        collateralVault: collateralPda,
        loanAmountLamports: args.loanAmountLamports,
        collateralAmount: args.collateralAmountLamports,
        interestRateBps: args.interestRateBps,
        durationDays: args.durationDays,
      },
      { programAddress: PROGRAM_ID }
    );

    const signature = await send({ instructions: [instruction] });

    return {
      signature,
      loanPda,
      collateralPda,
      loanIndex,
    };
  }

  async function repayLoan(
    loanPda: string,
    collateralPda: string,
    _loanIndex: number
  ): Promise<string> {
    if (!signer || !borrower) {
      throw new Error("Wallet not connected");
    }

    const [borrowerProfilePda] = await findBorrowerProfilePda(
      { borrower },
      { programAddress: PROGRAM_ID }
    );

    const instruction = await getRepayLoanInstructionAsync(
      {
        borrower: signer,
        loanAccount: loanPda as Address,
        collateralVault: collateralPda as Address,
        borrowerProfile: borrowerProfilePda,
      },
      { programAddress: PROGRAM_ID }
    );

    return send({ instructions: [instruction] });
  }

  return {
    createLoan,
    repayLoan,
    getPoolBalance,
    depositPool,
    getPoolStats,
    initializePool,
    isSending,
  };
}
