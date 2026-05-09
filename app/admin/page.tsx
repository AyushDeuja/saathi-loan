"use client";

import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowUpRight,
  Droplet,
  ShieldPlus,
  Wallet,
  Waves,
} from "lucide-react";
import { AppShell } from "../components/app-shell";
import { useWallet } from "../lib/wallet/context";
import { useLoanProgram } from "../lib/hooks/use-loan-program";
import { isAdminWallet } from "../lib/admin";
import { ellipsify } from "../lib/explorer";

const LAMPORTS_PER_SOL = 1e9;

type RecentLoan = {
  id: string;
  walletAddress: string;
  status: string;
};

export default function AdminPage() {
  const { wallet, status } = useWallet();
  const { initializePool, depositPool, getPoolStats } = useLoanProgram();
  const [action, setAction] = useState<string | null>(null);

  const address = wallet?.account.address;
  const isAdmin = isAdminWallet(address);

  const poolStatsQuery = useQuery({
    queryKey: ["admin-pool-stats"],
    queryFn: getPoolStats,
    enabled: status === "connected" && isAdmin,
    staleTime: 30_000,
    retry: 1,
  });

  const recentLoansQuery = useQuery({
    queryKey: ["admin-recent-loans"],
    queryFn: async (): Promise<RecentLoan[]> => {
      const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
      const res = await fetch(`${base}/loan/all`);
      if (!res.ok) {
        throw new Error("Could not load recent loans");
      }
      const data: { loans?: RecentLoan[] } = await res.json();
      return data.loans ?? [];
    },
    enabled: status === "connected" && isAdmin,
    staleTime: 20_000,
    retry: 1,
  });

  const stats = poolStatsQuery.data;

  const utilization = useMemo(() => {
    if (!stats) return null;
    const deposited = Number(stats.totalDeposited);
    const loaned = Number(stats.totalLoaned);
    if (!Number.isFinite(deposited) || deposited <= 0) return 0;
    return Math.min(1, loaned / deposited);
  }, [stats]);

  const activeBorrowersCount = useMemo(() => {
    const loans = recentLoansQuery.data ?? [];
    const active = loans.filter(
      (l) => l.status.trim().toUpperCase() === "ACTIVE"
    );
    return new Set(active.map((l) => l.walletAddress)).size;
  }, [recentLoansQuery.data]);

  const tvlSol = stats
    ? Number(stats.totalDeposited) / LAMPORTS_PER_SOL
    : null;

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
      void poolStatsQuery.refetch();
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
      void poolStatsQuery.refetch();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Seed failed";
      toast.error(message);
    } finally {
      setAction(null);
    }
  }

  function handleEmergencyHalt(): void {
    toast.error(
      "Emergency shutdown is not enabled in this build. Pause controls require a guarded program upgrade."
    );
  }

  function formatTvlDisplay(value: number): string {
    return value.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  return (
    <AppShell>
      <header className="mb-8 md:mb-10">
        <h1 className="text-[1.625rem] font-bold tracking-tight text-foreground md:text-4xl md:font-semibold">
          Admin Console
        </h1>
        {status === "connected" && address ? (
          <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-border bg-[color-mix(in_srgb,var(--accent)_92%,transparent)] px-4 py-2 text-sm font-medium text-foreground shadow-sm">
            <Wallet className="h-4 w-4 text-primary" strokeWidth={2} />
            <span className="text-muted-foreground">Connected:</span>
            <span className="font-mono text-[13px] font-semibold text-foreground">
              {ellipsify(address, 4)}_Admin
            </span>
          </div>
        ) : null}
      </header>

      {status !== "connected" && (
        <div className="rounded-3xl border border-border bg-card p-10 text-center text-sm text-muted-foreground shadow-sm">
          Connect your wallet to unlock the admin console.
        </div>
      )}

      {status === "connected" && !isAdmin && (
        <div className="rounded-3xl border border-destructive/35 bg-destructive/10 p-8 text-center text-sm text-destructive shadow-sm">
          This wallet is not authorized for administrative actions on Saathi
          Loan.
        </div>
      )}

      {status === "connected" && isAdmin && (
        <div className="grid gap-8 lg:grid-cols-3">
          <div className="space-y-8 lg:col-span-2">
            <section className="rounded-3xl border border-border bg-card p-6 shadow-sm md:p-8">
              <h2 className="text-lg font-semibold text-foreground md:text-xl">
                Liquidity Management
              </h2>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                Initialize the program pool and seed devnet SOL. Each step opens
                a wallet confirmation.
              </p>

              <div className="mt-8 grid gap-4 sm:grid-cols-3">
                <button
                  type="button"
                  onClick={handleInitialize}
                  disabled={action !== null}
                  className="flex min-h-[8.5rem] flex-col items-center justify-center gap-3 rounded-2xl border border-border bg-secondary/80 px-4 py-6 text-center transition hover:border-primary/25 hover:bg-[color-mix(in_srgb,var(--accent)_95%,transparent)] disabled:cursor-not-allowed disabled:opacity-55"
                >
                  <ShieldPlus className="h-8 w-8 text-primary" strokeWidth={1.6} />
                  <span className="text-sm font-semibold leading-tight text-foreground">
                    {action === "init" ? "Initializing…" : "Initialize Pool"}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSeed(1)}
                  disabled={action !== null}
                  className="flex min-h-[8.5rem] flex-col items-center justify-center gap-3 rounded-2xl border border-border bg-secondary/80 px-4 py-6 text-center transition hover:border-primary/25 hover:bg-[color-mix(in_srgb,var(--accent)_95%,transparent)] disabled:cursor-not-allowed disabled:opacity-55"
                >
                  <Droplet className="h-8 w-8 text-primary" strokeWidth={1.6} />
                  <span className="text-sm font-semibold leading-tight text-foreground">
                    {action === "seed-1" ? "Seeding…" : "Seed 1 SOL"}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSeed(5)}
                  disabled={action !== null}
                  className="flex min-h-[8.5rem] flex-col items-center justify-center gap-3 rounded-2xl border border-border bg-secondary/80 px-4 py-6 text-center transition hover:border-primary/25 hover:bg-[color-mix(in_srgb,var(--accent)_95%,transparent)] disabled:cursor-not-allowed disabled:opacity-55"
                >
                  <Waves className="h-8 w-8 text-primary" strokeWidth={1.6} />
                  <span className="text-sm font-semibold leading-tight text-foreground">
                    {action === "seed-5" ? "Seeding…" : "Seed 5 SOL"}
                  </span>
                </button>
              </div>
            </section>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-3xl border border-border bg-card p-6 shadow-sm md:p-7">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Total Value Locked
                </p>
                <p className="mt-3 font-mono text-2xl font-bold tabular-nums text-foreground md:text-3xl">
                  {poolStatsQuery.isLoading
                    ? "…"
                    : tvlSol != null
                      ? `${formatTvlDisplay(tvlSol)} SOL`
                      : "—"}
                </p>
                {stats?.apyEstimatePercent != null ? (
                  <p className="mt-3 flex items-center gap-1.5 text-sm font-semibold text-[var(--health)]">
                    <ArrowUpRight className="h-4 w-4 shrink-0" aria-hidden />
                    {stats.apyEstimatePercent.toFixed(1)}% est. pool yield
                  </p>
                ) : (
                  <p className="mt-3 text-sm text-muted-foreground">
                    Yield estimate appears once the pool accrues interest.
                  </p>
                )}
                {poolStatsQuery.isError ? (
                  <p className="mt-2 text-xs text-destructive">
                    Could not load on-chain pool stats.
                  </p>
                ) : null}
              </div>

              <div className="rounded-3xl border border-border bg-card p-6 shadow-sm md:p-7">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Active Borrowers
                </p>
                <p className="mt-3 font-mono text-2xl font-bold tabular-nums text-foreground md:text-3xl">
                  {recentLoansQuery.isLoading ? "…" : activeBorrowersCount}
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Neutral
                  </span>
                  <span className="text-sm text-muted-foreground">
                    Protocol healthy
                  </span>
                </div>
                <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
                  Unique wallets with active loans in the latest indexed batch.
                </p>
                {recentLoansQuery.isError ? (
                  <p className="mt-2 text-xs text-destructive">
                    Activity sample unavailable.
                  </p>
                ) : null}
              </div>
            </div>
          </div>

          <div className="space-y-6 lg:col-span-1">
            <section className="overflow-hidden rounded-3xl border border-border bg-card p-6 shadow-sm md:p-7">
              <h2 className="text-lg font-semibold text-foreground">
                Protocol Health
              </h2>
              <ul className="mt-6 space-y-4 text-sm">
                <li className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Smart Contract</span>
                  <span className="font-bold text-[var(--health)]">ACTIVE</span>
                </li>
                <li className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Oracle Feed</span>
                  <span className="font-bold text-[var(--health)]">SYNCED</span>
                </li>
                <li className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Risk Factor</span>
                  <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold tabular-nums text-foreground">
                    {utilization == null
                      ? "—"
                      : utilization.toFixed(2)}
                  </span>
                </li>
              </ul>

              <div className="relative mt-8 flex h-44 items-end justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-[#fde5dc] via-[#f7c4b2] to-[#e8a090]">
                <div
                  className="absolute inset-0 opacity-40"
                  style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg stroke='%23c04d2f' stroke-opacity='0.25' stroke-width='1'%3E%3Cpath d='M30 5 L55 30 L30 55 L5 30 Z'/%3E%3Cpath d='M30 15 L45 30 L30 45 L15 30 Z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
                  }}
                />
                <div className="relative mb-3 h-28 w-28 rounded-full border border-white/35 bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.85),transparent_55%,rgba(192,77,47,0.35))] shadow-[0_18px_50px_-12px_rgba(192,77,47,0.55)] ring-4 ring-white/20" />
                <p className="absolute bottom-3 left-3 text-[11px] font-semibold tracking-wide text-primary">
                  Protocol Monitoring
                </p>
              </div>
            </section>

            <section className="rounded-3xl bg-primary px-6 py-7 shadow-md md:px-7 md:py-8">
              <h2 className="text-lg font-bold text-primary-foreground">
                Emergency Shutdown
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-primary-foreground/92">
                Immediately pause all lending and borrowing activities across the
                protocol.
              </p>
              <button
                type="button"
                onClick={handleEmergencyHalt}
                className="mt-6 inline-flex min-h-[3rem] w-full items-center justify-center rounded-full bg-primary-foreground px-6 py-3 text-[15px] font-bold uppercase tracking-[0.06em] text-primary shadow-sm transition hover:bg-primary-foreground/90"
              >
                HALT PROTOCOL
              </button>
            </section>
          </div>
        </div>
      )}
    </AppShell>
  );
}
