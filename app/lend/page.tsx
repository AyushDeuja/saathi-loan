"use client";

import { useMemo, useState, type FormEvent } from "react";
import toast from "react-hot-toast";
import { ArrowDownToLine, ExternalLink, TrendingUp } from "lucide-react";
import { useLoanProgram } from "../lib/hooks/use-loan-program";
import { useQuery } from "@tanstack/react-query";
import { useCluster } from "../components/cluster-context";
import { AppShell } from "../components/app-shell";
import { useWallet } from "../lib/wallet/context";
import { useBalance } from "../lib/hooks/use-balance";
import { lamportsToSolString } from "../lib/lamports";

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

const LAMPORTS_PER_SOL = 1_000_000_000n;
const PROTOCOL_FEE_PERCENT = 0.15;

function formatSolUsdStyle(value: number, decimals: number): string {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function activityStatusPill(
  status: string
): { label: string; className: string } {
  const s = status.trim().toUpperCase();
  if (s === "ACTIVE") {
    return {
      label: "PENDING",
      className: "bg-amber-400/20 text-amber-900 dark:text-amber-100",
    };
  }
  if (s === "LIQUIDATED") {
    return {
      label: "LIQUIDATED",
      className: "bg-destructive/15 text-destructive",
    };
  }
  return {
    label: "SUCCESS",
    className:
      "bg-[var(--health-muted)] text-[color:var(--health)] font-bold",
  };
}

export default function LendPage() {
  const { status, wallet } = useWallet();
  const address = wallet?.account.address;
  const balance = useBalance(address);

  const { depositPool, getPoolStats, getPoolBalance } = useLoanProgram();
  const { cluster } = useCluster();
  const [statsOverride, setStatsOverride] = useState<PoolStats | null>(null);
  const [amount, setAmount] = useState("");
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

  const poolVaultQuery = useQuery({
    queryKey: ["lend-pool-vault-balance"],
    queryFn: getPoolBalance,
    staleTime: 20_000,
    retry: 1,
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

  const stats = statsOverride ?? poolStatsQuery.data ?? null;

  const utilizationPct = useMemo(() => {
    if (!stats) return null;
    const dep = Number(stats.totalDeposited);
    const loaned = Number(stats.totalLoaned);
    if (!Number.isFinite(dep) || dep <= 0) return null;
    return (loaned / dep) * 100;
  }, [stats]);

  const amountNum = Number(amount);
  const validAmount =
    Number.isFinite(amountNum) && amountNum > 0 && amountNum < 1e15;

  const dailyEarningSol = useMemo(() => {
    if (!validAmount || stats?.apyEstimatePercent == null) return null;
    return (amountNum * (stats.apyEstimatePercent / 100)) / 365;
  }, [amountNum, stats?.apyEstimatePercent, validAmount]);

  const solscanBase =
    cluster === "mainnet"
      ? "https://solscan.io"
      : `https://solscan.io?cluster=${cluster === "localnet" ? "custom" : cluster}`;

  function walletBalanceSol(): number | null {
    if (balance.lamports == null) return null;
    return Number(balance.lamports) / Number(LAMPORTS_PER_SOL);
  }

  function handleMax(): void {
    const sol = walletBalanceSol();
    if (sol == null || sol <= 0) {
      toast.error("Connect a wallet to use MAX.");
      return;
    }
    setAmount(sol.toFixed(9).replace(/\.?0+$/, ""));
  }

  async function handleDeposit(e: FormEvent) {
    e.preventDefault();
    if (status !== "connected") {
      toast.error("Connect your wallet first.");
      return;
    }
    if (!amount) return;
    const sol = Number(amount);
    if (Number.isNaN(sol) || sol <= 0) {
      toast.error("Enter a valid amount");
      return;
    }

    const lamports = BigInt(Math.floor(sol * 1e9));
    setLoading(true);
    try {
      const sig = await depositPool(lamports);
      toast.success("Deposit successful! You are now earning yield.");
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
      void poolActivityQuery.refetch();
      void poolVaultQuery.refetch();
      void balance.mutate();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Deposit failed";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  const loans = poolActivityQuery.data ?? [];

  const depositedSol = stats ? Number(stats.totalDeposited) / 1e9 : null;
  const loanedSol = stats ? Number(stats.totalLoaned) / 1e9 : null;
  const availableSol = stats ? Number(stats.availableLiquidity) / 1e9 : null;
  const vaultSol = poolVaultQuery.data
    ? Number(poolVaultQuery.data) / 1e9
    : null;

  const balanceDisplay =
    balance.lamports != null
      ? lamportsToSolString(balance.lamports, 4)
      : "—";

  return (
    <AppShell>
      <header className="mb-10 max-w-4xl">
        <h1 className="text-[1.65rem] font-bold tracking-tight text-foreground md:text-4xl md:font-semibold">
          Liquidity Provision
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground md:text-base md:leading-relaxed">
          Earn competitive yield by providing capital to Saathi Loan&apos;s
          peer-to-peer lending pool. Positions are routed through the on-chain
          program vault with transparent utilization.
        </p>
      </header>

      <section className="mb-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm md:rounded-3xl md:p-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Total Deposited
          </p>
          <p className="mt-3 font-mono text-xl font-semibold tabular-nums text-foreground md:text-2xl">
            {poolStatsQuery.isLoading
              ? "…"
              : depositedSol != null
                ? `${formatSolUsdStyle(depositedSol, 2)} SOL`
                : "—"}
          </p>
          {stats?.apyEstimatePercent != null ? (
            <p className="mt-2 flex items-center gap-1 text-sm font-semibold text-[var(--health)]">
              <TrendingUp className="h-4 w-4" aria-hidden strokeWidth={2} />+
              {stats.apyEstimatePercent.toFixed(1)}% est. yield
            </p>
          ) : (
            <p className="mt-2 text-xs text-muted-foreground">
              Yield appears as interest accrues.
            </p>
          )}
          {vaultSol != null ? (
            <p className="mt-2 text-[11px] text-muted-foreground">
              Vault balance (RPC):{" "}
              <span className="font-mono tabular-nums">
                {formatSolUsdStyle(vaultSol, 4)} SOL
              </span>
            </p>
          ) : poolVaultQuery.isError ? (
            <p className="mt-2 text-[11px] text-destructive">
              Vault balance unavailable.
            </p>
          ) : null}
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm md:rounded-3xl md:p-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Total Loaned
          </p>
          <p className="mt-3 font-mono text-xl font-semibold tabular-nums text-foreground md:text-2xl">
            {poolStatsQuery.isLoading
              ? "…"
              : loanedSol != null
                ? `${formatSolUsdStyle(loanedSol, 2)} SOL`
                : "—"}
          </p>
          {utilizationPct != null ? (
            <p className="mt-2 text-sm text-muted-foreground">
              {utilizationPct.toFixed(1)}% Utilization
            </p>
          ) : (
            <p className="mt-2 text-xs text-muted-foreground">
              Utilization reflects loaned versus deposited SOL.
            </p>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm md:rounded-3xl md:p-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Available Liquidity
          </p>
          <p className="mt-3 font-mono text-xl font-semibold tabular-nums text-foreground md:text-2xl">
            {poolStatsQuery.isLoading
              ? "…"
              : availableSol != null
                ? `${formatSolUsdStyle(availableSol, 2)} SOL`
                : "—"}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Ready to be deployed
          </p>
        </div>

        <div className="rounded-2xl border border-primary/20 bg-[color-mix(in_srgb,var(--accent)_88%,white)] p-5 shadow-sm md:rounded-3xl md:p-6 dark:bg-[color-mix(in_srgb,var(--accent)_25%,transparent)]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Estimated APY
          </p>
          <p className="mt-3 font-mono text-xl font-semibold tabular-nums text-primary md:text-2xl">
            {poolStatsQuery.isLoading
              ? "…"
              : stats?.apyEstimatePercent != null
                ? `${stats.apyEstimatePercent.toFixed(2)}%`
                : "—"}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Variable protocol yield
          </p>
        </div>
      </section>

      {poolStatsQuery.isError && (
        <div className="mb-8 rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Failed to load pool stats.
          {poolStatsQuery.error instanceof Error ? (
            <span className="ml-1 text-muted-foreground">
              {poolStatsQuery.error.message}
            </span>
          ) : null}
          <button
            type="button"
            onClick={() => poolStatsQuery.refetch()}
            className="ml-2 font-semibold underline"
          >
            Retry
          </button>
        </div>
      )}

      <div className="mb-12 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.92fr)]">
        <section className="rounded-3xl border border-border bg-card p-6 shadow-sm md:p-8">
          <h2 className="text-lg font-semibold text-foreground md:text-xl">
            Lend Capital
          </h2>
          <form className="mt-6 space-y-5" onSubmit={handleDeposit}>
            <div className="space-y-2">
              <label
                htmlFor="lend-amount"
                className="text-sm font-medium text-foreground"
              >
                Amount to Deposit
              </label>
              <div className="relative">
                <input
                  id="lend-amount"
                  type="number"
                  min="0"
                  step="0.0001"
                  autoComplete="off"
                  placeholder="0.00"
                  disabled={status !== "connected"}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="h-[3.25rem] w-full rounded-2xl border border-input bg-background pr-14 pl-4 text-[15px] shadow-inner outline-none transition focus:border-primary/45 focus:ring-[3px] focus:ring-primary/15 disabled:opacity-55"
                />
                <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm font-semibold text-muted-foreground">
                  SOL
                </span>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-muted-foreground">
                  Balance:{" "}
                  <span className="font-mono font-semibold text-foreground">
                    {balance.isLoading ? "…" : balanceDisplay} SOL
                  </span>
                </p>
                <button
                  type="button"
                  onClick={handleMax}
                  disabled={
                    status !== "connected" || balance.lamports == null || loading
                  }
                  className="text-xs font-bold uppercase tracking-wide text-destructive underline-offset-2 hover:underline disabled:opacity-40"
                >
                  MAX
                </button>
              </div>
            </div>

            <div className="rounded-2xl bg-[color-mix(in_srgb,var(--accent)_90%,transparent)] px-5 py-4 dark:bg-[color-mix(in_srgb,var(--accent)_22%,transparent)]">
              <div className="flex items-center justify-between gap-4 text-sm">
                <span className="text-muted-foreground">Daily earning</span>
                <span className="font-mono font-semibold tabular-nums text-foreground">
                  {dailyEarningSol != null
                    ? `~ ${dailyEarningSol.toFixed(4)} SOL`
                    : "~ — SOL"}
                </span>
              </div>
              <div className="mt-3 flex items-center justify-between gap-4 border-t border-border/60 pt-3 text-sm">
                <span className="text-muted-foreground">Protocol fee</span>
                <span className="font-semibold tabular-nums">
                  {PROTOCOL_FEE_PERCENT}%
                </span>
              </div>
            </div>

            <button
              disabled={
                loading || status !== "connected" || !validAmount || amount === ""
              }
              type="submit"
              className="flex min-h-[3.35rem] w-full items-center justify-center rounded-full bg-primary px-6 text-[15px] font-semibold text-primary-foreground shadow-md transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-55"
            >
              {loading ? "Confirm in wallet…" : "Deposit Assets"}
            </button>

            <p className="text-[11px] leading-relaxed text-muted-foreground">
              Deposits move SOL into the shared pool vault. Yield is estimated
              from protocol interest flows and utilization; returns are not
              guaranteed.
            </p>
          </form>
        </section>

        <section className="relative overflow-hidden rounded-3xl border border-border bg-card p-6 shadow-sm md:p-8">
          <div className="pointer-events-none absolute inset-x-8 bottom-[28%] top-24 rounded-3xl bg-gradient-to-t from-[#fde5dc]/90 via-transparent to-transparent" />
          <div className="relative flex h-full min-h-[280px] flex-col justify-between">
            <div className="relative z-10">
              <h2 className="text-xl font-semibold text-foreground md:text-[1.35rem]">
                Sustainable Yield
              </h2>
              <p className="mt-4 max-w-md text-sm leading-relaxed text-muted-foreground md:text-[15px]">
                Automated pool accounting reallocates dormant liquidity toward
                active borrows while crediting lenders with accrued interest —
                maximizing transparent, on-chain spreads without hidden fees.
              </p>
            </div>
            <div className="relative z-10 mt-10 flex flex-1 items-end justify-center gap-1.5 sm:gap-2">
              {[
                42, 55, 38, 68, 48, 82, 60, 95, 71, 100, 78, 88,
              ].map((h, i) => (
                <div
                  key={i}
                  className="flex w-[6%] min-w-[4px] max-w-[28px] flex-col justify-end"
                  style={{ height: 140 }}
                >
                  <div
                    className="rounded-t-md bg-gradient-to-t from-primary/85 to-[#fdb9a8]"
                    style={{ height: `${h}%`, minHeight: 8 }}
                  />
                </div>
              ))}
              <svg
                className="pointer-events-none absolute inset-x-6 bottom-[18%] h-28 w-auto text-primary opacity-90"
                viewBox="0 0 200 48"
                fill="none"
                aria-hidden
              >
                <path
                  d="M4 40 C28 38,40 28,52 32 C74 42,94 14,118 22 C146 34,168 16,196 30"
                  stroke="currentColor"
                  strokeWidth="2.25"
                  strokeLinecap="round"
                />
              </svg>
            </div>
          </div>
        </section>
      </div>

      {poolActivityQuery.isError && !poolStatsQuery.isError && (
        <div className="mb-8 rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Could not refresh recent activity.
          {poolActivityQuery.error instanceof Error ? (
            <span className="ml-1 text-muted-foreground">
              {poolActivityQuery.error.message}
            </span>
          ) : null}
        </div>
      )}

      <section>
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground md:text-xl">
              Recent Activity
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Global real-time lending actions from the indexer
            </p>
          </div>
          <a
            href={solscanBase}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary underline-offset-4 hover:underline"
          >
            View explorer
            <ExternalLink className="h-4 w-4" aria-hidden strokeWidth={2} />
          </a>
        </div>

        <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-border bg-accent/50 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-5 py-4">Wallet Address</th>
                  <th className="px-5 py-4">Action</th>
                  <th className="px-5 py-4">Amount</th>
                  <th className="px-5 py-4">Status</th>
                  <th className="px-5 py-4">Date</th>
                </tr>
              </thead>
              <tbody>
                {poolActivityQuery.isLoading && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-5 py-10 text-center text-muted-foreground"
                    >
                      Loading activity…
                    </td>
                  </tr>
                )}
                {!poolActivityQuery.isLoading &&
                  loans.map((l) => {
                    const short = `${l.walletAddress?.slice(0, 4) ?? ""}…${l.walletAddress?.slice(-4) ?? ""}`;
                    const pill = activityStatusPill(l.status);
                    return (
                      <tr
                        key={l.id}
                        className="border-b border-border/70 last:border-0"
                      >
                        <td className="px-5 py-4 font-mono text-xs text-foreground">
                          {short}
                        </td>
                        <td className="px-5 py-4">
                          <span className="inline-flex items-center gap-2 font-medium text-foreground">
                            <ArrowDownToLine
                              className="h-4 w-4 text-primary"
                              strokeWidth={2}
                              aria-hidden
                            />
                            Borrow
                          </span>
                        </td>
                        <td className="px-5 py-4 font-mono text-sm font-bold tabular-nums">
                          {(Number(l.loanAmountLamports) / 1e9).toFixed(2)} SOL
                        </td>
                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide ${pill.className}`}
                          >
                            {pill.label}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-muted-foreground">
                          {new Date(l.createdAt).toLocaleString(undefined, {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                      </tr>
                    );
                  })}
                {!poolActivityQuery.isLoading && loans.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-5 py-12 text-center text-muted-foreground"
                    >
                      No recent activity
                    </td>
                  </tr>
                )}
                {poolActivityQuery.isError && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-5 py-10 text-center text-destructive"
                    >
                      Failed to load activity.{" "}
                      <button
                        type="button"
                        onClick={() => poolActivityQuery.refetch()}
                        className="font-semibold underline"
                      >
                        Retry
                      </button>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </AppShell>
  );
}
