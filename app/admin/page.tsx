"use client";

import React, { useState } from "react";
import toast from "react-hot-toast";
import { useWallet } from "../lib/wallet/context";
import { useLoanProgram } from "../lib/hooks/use-loan-program";
import { isAdminWallet } from "../lib/admin";
import { AppShell } from "../components/app-shell";

const SEED_AMOUNTS = [1, 5];

export default function AdminPage() {
  const { wallet, status } = useWallet();
  const { initializePool, depositPool } = useLoanProgram();
  const [action, setAction] = useState<string | null>(null);

  const address = wallet?.account.address;
  const isAdmin = isAdminWallet(address);

  async function handleInitialize() {
    if (!address) return toast.error("Connect your wallet first");
    setAction("init");
    try {
      const sig = await initializePool();
      toast.success("Pool initialized.");
      toast(() => (
        <span>
          View on Solscan →{" "}
          <a
            href={`https://solscan.io/tx/${sig}?cluster=devnet`}
            target="_blank"
            rel="noreferrer"
            className="underline"
          >
            link
          </a>
        </span>
      ));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Init failed";
      toast.error(message);
    } finally {
      setAction(null);
    }
  }

  async function handleSeed(amount: number) {
    if (!address) return toast.error("Connect your wallet first");
    setAction(`seed-${amount}`);
    try {
      const lamports = BigInt(Math.floor(amount * 1e9));
      const sig = await depositPool(lamports);
      toast.success(`Seeded pool with ${amount} SOL.`);
      toast(() => (
        <span>
          View on Solscan →{" "}
          <a
            href={`https://solscan.io/tx/${sig}?cluster=devnet`}
            target="_blank"
            rel="noreferrer"
            className="underline"
          >
            link
          </a>
        </span>
      ));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Seed failed";
      toast.error(message);
    } finally {
      setAction(null);
    }
  }

  return (
    <AppShell>
      <div className="mb-6 space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
          Admin Console
        </h1>
        <p className="text-sm text-muted-foreground md:text-base">
          Admin-only actions for pool initialization and seeding.
        </p>
      </div>

      {status !== "connected" && (
        <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
          Connect your wallet to access admin actions.
        </div>
      )}

      {status === "connected" && !isAdmin && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          This wallet is not authorized for admin actions.
        </div>
      )}

      {status === "connected" && isAdmin && (
        <div className="space-y-6">
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="mb-3 text-sm text-muted-foreground">Pool</div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleInitialize}
                disabled={action !== null}
                className="rounded-lg border border-border bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground transition hover:bg-secondary/80 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60"
              >
                {action === "init" ? "Initializing…" : "Initialize Pool"}
              </button>
              {SEED_AMOUNTS.map((amount) => (
                <button
                  key={amount}
                  type="button"
                  onClick={() => handleSeed(amount)}
                  disabled={action !== null}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {action === `seed-${amount}`
                    ? `Seeding ${amount} SOL…`
                    : `Seed ${amount} SOL`}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-secondary/40 p-4 text-xs text-muted-foreground">
            Logged in as: <span className="font-mono">{address}</span>
          </div>
        </div>
      )}
    </AppShell>
  );
}
