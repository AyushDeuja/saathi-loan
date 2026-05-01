"use client";

import { useMemo, useState } from "react";
import { lamports, type Address } from "@solana/kit";
import toast from "react-hot-toast";
import { useWallet } from "../lib/wallet/context";
import { useBalance } from "../lib/hooks/use-balance";
import { useSendTransaction } from "../lib/hooks/use-send-transaction";
import { lamportsFromSol, lamportsToSolString } from "../lib/lamports";
import {
  findPoolPda,
  getDepositPoolInstructionAsync,
} from "../generated/vault";

const PROGRAM_ID =
  (process.env.NEXT_PUBLIC_PROGRAM_ID as Address | undefined) ?? undefined;

export function VaultCard() {
  const { signer, status } = useWallet();
  const { send, isSending } = useSendTransaction();
  const [amount, setAmount] = useState("0.1");
  const [poolAddress, setPoolAddress] = useState<Address | null>(null);

  const poolAddressPromise = useMemo(
    () => findPoolPda(PROGRAM_ID ? { programAddress: PROGRAM_ID } : {}),
    []
  );

  const poolBalance = useBalance(poolAddress ?? undefined);

  async function handleDeposit() {
    if (!signer) {
      toast.error("Connect your wallet first.");
      return;
    }

    const parsed = Number(amount);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      toast.error("Enter a valid amount in SOL.");
      return;
    }

    try {
      const [derivedPool] = await poolAddressPromise;
      setPoolAddress(derivedPool);

      const instruction = await getDepositPoolInstructionAsync(
        {
          lender: signer,
          pool: derivedPool,
          amount: lamportsFromSol(parsed),
        },
        PROGRAM_ID ? { programAddress: PROGRAM_ID } : undefined
      );

      await send({ instructions: [instruction] });
      toast.success("Deposit transaction sent.");
      poolBalance.mutate();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(message || "Deposit failed.");
    }
  }

  return (
    <section className="w-full rounded-2xl border border-border bg-card p-6">
      <h2 className="text-lg font-semibold">Pool Deposit</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Quick utility card for testing pool deposits.
      </p>

      <div className="mt-4 rounded-lg bg-background p-3">
        <p className="text-xs text-muted-foreground">Pool Balance</p>
        <p className="font-mono text-xl tabular-nums">
          {poolBalance.lamports
            ? lamportsToSolString(poolBalance.lamports)
            : "0"}{" "}
          SOL
        </p>
      </div>

      <div className="mt-4 flex gap-3">
        <input
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          inputMode="decimal"
          aria-label="Deposit amount in SOL"
          className="h-11 flex-1 rounded-lg border border-input bg-background px-3 text-sm"
          placeholder="0.10"
        />
        <button
          type="button"
          onClick={handleDeposit}
          disabled={status !== "connected" || isSending}
          className="h-11 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSending ? "Submitting..." : "Deposit"}
        </button>
      </div>
    </section>
  );
}
