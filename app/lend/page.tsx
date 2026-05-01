"use client";

import React, { useState } from "react";
import toast from "react-hot-toast";
import { useLoanProgram } from "../lib/hooks/use-loan-program";
import { useQuery } from "@tanstack/react-query";
import { useCluster } from "../components/cluster-context";
import { AppShell } from "../components/app-shell";
import { PageHeader } from "../components/page-header";

type PoolStats = {
  totalDeposited: string;
  totalLoaned: string;
  totalInterestEarned: string;
  availableLiquidity: string;
  apyEstimatePercent: number | null;
};

type RecentLoan = {
  id: string;
  walletAddress: string;
  loanAmountLamports: string;
  status: string;
  createdAt: string;
};

export default function LendPage() {
  const { depositPool, getPoolStats } = useLoanProgram();
  const { cluster } = useCluster();
  const [statsOverride, setStatsOverride] = useState<PoolStats | null>(null);
  const [amount, setAmount] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const poolStatsQuery = useQuery({
    queryKey: ["pool-stats"],
    queryFn: getPoolStats,
    staleTime: 30_000,
    retry: (failureCount, error) => {
      if (failureCount >= 2) return false;
      if (error instanceof Error && error.message.includes("429")) return true;
      return failureCount < 1;
    },
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 5000),
  });

  const poolActivityQuery = useQuery({
    queryKey: ["pool-activity"],
    queryFn: async (): Promise<RecentLoan[]> => {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/loan/all`);
      if (!res.ok) {
        let message = "Failed to load pool activity";
        try {
          const payload = (await res.json()) as { error?: string };
          if (payload.error) {
            message = payload.error;
          }
        } catch {
          // Ignore parse errors and keep fallback message.
        }
        if (res.status === 429) {
          message = "Rate limited while loading activity (429). Retry shortly.";
        }
        throw new Error(message);
      }
      const data: { loans?: RecentLoan[] } = await res.json();
      return data.loans ?? [];
    },
    staleTime: 15_000,
    retry: (failureCount, error) => {
      if (failureCount >= 2) return false;
      if (error instanceof Error && error.message.includes("429")) return true;
      return failureCount < 1;
    },
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 5000),
  });

  async function handleDeposit(e: React.FormEvent) {
    e.preventDefault();
    if (!amount) return;
    const sol = Number(amount);
    if (isNaN(sol) || sol <= 0) return toast.error("Enter a valid amount");

    const lamports = BigInt(Math.floor(sol * 1e9));
    setLoading(true);
    try {
      const sig = await depositPool(lamports);
      toast.success("Deposit successful! You are now earning yield.");
      // show tx link
      toast(() => (
        <span>
          View on Solscan →{" "}
          <a
            href={`https://solscan.io/tx/${sig}?cluster=${cluster === "localnet" ? "custom" : cluster}`}
            target="_blank"
            rel="noreferrer"
            className="underline"
          >
            link
          </a>
        </span>
      ));
      setAmount("");
      const refreshed = await getPoolStats();
      setStatsOverride(refreshed);
      poolActivityQuery.refetch();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Deposit failed";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  const stats = statsOverride ?? poolStatsQuery.data ?? null;
  const loans = poolActivityQuery.data ?? [];

  return (
    <AppShell>
      <PageHeader
        eyebrow="Liquidity"
        title="Lend — pool management"
        accent="Deposit SOL. Earn yield."
        description="Add SOL to the shared pool and monitor borrower activity in one place."
      />

      <section className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-sm text-muted-foreground">Total Pool Size</div>
          <div className="mt-2 text-lg font-medium">
            {poolStatsQuery.isLoading
              ? "Loading…"
              : stats
                ? (Number(stats.totalDeposited) / 1e9).toFixed(4)
                : "—"}{" "}
            SOL
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-sm text-muted-foreground">Total Loaned Out</div>
          <div className="mt-2 text-lg font-medium">
            {poolStatsQuery.isLoading
              ? "Loading…"
              : stats
                ? (Number(stats.totalLoaned) / 1e9).toFixed(4)
                : "—"}{" "}
            SOL
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-sm text-muted-foreground">
            Available Liquidity
          </div>
          <div className="mt-2 text-lg font-medium">
            {poolStatsQuery.isLoading
              ? "Loading…"
              : stats
                ? `${(Number(stats.availableLiquidity) / 1e9).toFixed(4)} SOL`
                : "—"}
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-sm text-muted-foreground">Estimated APY</div>
          <div className="mt-2 text-lg font-medium">
            {poolStatsQuery.isLoading
              ? "Loading…"
              : stats && stats.apyEstimatePercent !== null
                ? `${stats.apyEstimatePercent}%`
                : "—"}
          </div>
        </div>
      </section>

      {poolStatsQuery.isError && (
        <div className="mb-6 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          Failed to load pool stats.
          {poolStatsQuery.error instanceof Error ? (
            <span className="ml-1 text-muted-foreground">
              {poolStatsQuery.error.message}
            </span>
          ) : null}
          <button
            type="button"
            onClick={() => poolStatsQuery.refetch()}
            className="ml-2 underline"
          >
            Retry
          </button>
        </div>
      )}

      {poolActivityQuery.isError && !poolStatsQuery.isError && (
        <div className="mb-6 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          Could not refresh recent activity.
          {poolActivityQuery.error instanceof Error ? (
            <span className="ml-1 text-muted-foreground">
              {poolActivityQuery.error.message}
            </span>
          ) : null}
        </div>
      )}

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Deposit
        </h2>
        <form onSubmit={handleDeposit} className="flex items-end gap-2">
          <div className="flex flex-col gap-1">
            <label
              htmlFor="deposit-amount"
              className="text-xs text-muted-foreground"
            >
              Amount (SOL)
            </label>
            <input
              id="deposit-amount"
              type="number"
              min="0"
              step="0.0001"
              autoComplete="off"
              className="w-40 rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              placeholder="0.10"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <button
            disabled={loading}
            type="submit"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-xs transition hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Processing…" : "Deposit SOL"}
          </button>
        </form>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Recent pool activity
        </h2>
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full table-fixed text-sm">
            <thead className="bg-secondary/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="p-2">Wallet</th>
                <th className="p-2">Amount (SOL)</th>
                <th className="p-2">Status</th>
                <th className="p-2">Date</th>
              </tr>
            </thead>
            <tbody>
              {poolActivityQuery.isLoading && (
                <tr>
                  <td
                    colSpan={4}
                    className="p-4 text-center text-sm text-muted-foreground"
                  >
                    Loading activity…
                  </td>
                </tr>
              )}
              {!poolActivityQuery.isLoading &&
                loans.map((l) => (
                  <tr key={l.id} className="border-t">
                    <td className="p-2">
                      {l.walletAddress?.slice(0, 6)}…
                      {l.walletAddress?.slice(-4)}
                    </td>
                    <td className="p-2">
                      {(Number(l.loanAmountLamports) / 1e9).toFixed(4)}
                    </td>
                    <td className="p-2">{l.status}</td>
                    <td className="p-2">
                      {new Date(l.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              {!poolActivityQuery.isLoading && loans.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className="p-4 text-center text-sm text-muted-foreground"
                  >
                    No recent activity
                  </td>
                </tr>
              )}
              {poolActivityQuery.isError && (
                <tr>
                  <td
                    colSpan={4}
                    className="p-4 text-center text-sm text-destructive"
                  >
                    Failed to load activity.
                    {poolActivityQuery.error instanceof Error ? (
                      <span className="ml-1 text-muted-foreground">
                        {poolActivityQuery.error.message}
                      </span>
                    ) : null}{" "}
                    <button
                      type="button"
                      onClick={() => poolActivityQuery.refetch()}
                      className="underline"
                    >
                      Retry
                    </button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </AppShell>
  );
}
