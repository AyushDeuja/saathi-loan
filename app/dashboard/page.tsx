"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  BadgeCheck,
  CheckCircle2,
  ChevronDown,
  Download,
  Plus,
  TrendingUp,
} from "lucide-react";
import { AppShell } from "../components/app-shell";
import { WalletButton } from "../components/wallet-button";
import { getLoans, getRiskScore, type LoanRecord } from "../lib/api";
import { getLoanPdaMap } from "../lib/loan-local";
import { useWallet } from "../lib/wallet/context";
import { useLoanProgram } from "../lib/hooks/use-loan-program";

type LocalRepayMap = Record<string, boolean>;

const LAMPORTS_PER_SOL = 1_000_000_000;

const MONTH_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function lamportsStringToSol(value: string): string {
  const numeric = Number(value) / LAMPORTS_PER_SOL;
  return numeric.toLocaleString(undefined, {
    minimumFractionDigits: numeric < 1 ? 4 : 2,
    maximumFractionDigits: 4,
  });
}

function normalizeStatus(status: string): string {
  return status.trim().toUpperCase();
}

function estimateSimpleInterestLamports(loan: LoanRecord): number {
  const principal = Number(loan.loanAmountLamports);
  if (!Number.isFinite(principal) || principal <= 0) return 0;
  return Math.ceil((principal * loan.interestBps) / 10000);
}

function buildLoanCsv(loans: LoanRecord[]): string {
  const rows: string[] = [
    [
      "loanId",
      "amountSol",
      "collateralSol",
      "interestPercent",
      "borrowedAt",
      "due",
      "closedAt",
      "status",
    ].join(","),
  ];
  loans.forEach((loan) => {
    const amount = Number(loan.loanAmountLamports) / LAMPORTS_PER_SOL;
    const collateral =
      Number(loan.collateralAmountLamports) / LAMPORTS_PER_SOL;
    const interestPct = (loan.interestBps / 100).toFixed(2);
    const borrowed = new Date(loan.createdAt).toISOString();
    const due = new Date(Number(loan.dueTimestamp) * 1000).toISOString();
    const closed = loan.updatedAt
      ? new Date(loan.updatedAt).toISOString()
      : "";
    const escaped = (value: string): string =>
      `"${value.replace(/"/g, '""')}"`;
    rows.push(
      [
        escaped(loan.id),
        amount,
        collateral,
        interestPct,
        escaped(borrowed),
        escaped(due),
        escaped(closed),
        escaped(normalizeStatus(loan.status)),
      ].join(",")
    );
  });
  return rows.join("\n");
}

function downloadTextFile(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function creditHealthFromScore(score: number): {
  label: string;
  tone: "healthy" | "watch" | "risk";
} {
  if (score >= 62) return { label: "Healthy", tone: "healthy" };
  if (score >= 42) return { label: "Watch", tone: "watch" };
  return { label: "At Risk", tone: "risk" };
}

function loanDisplaySuffix(id: string): string {
  const tail = id.replace(/\D/g, "").slice(-3);
  return tail.length > 0 ? tail : id.slice(-3);
}

/** Term progress toward due date (0–100); not partial principal repayment */
function tenorProgressPct(loan: LoanRecord, nowMs: number): number {
  const start = new Date(loan.createdAt).getTime();
  const due = Number(loan.dueTimestamp) * 1000;
  if (!Number.isFinite(due) || due <= start) return 0;
  const pct = Math.round(((nowMs - start) / (due - start)) * 100);
  return Math.min(100, Math.max(0, pct));
}

function lastMonthsLabels(count: number): string[] {
  const labels: string[] = [];
  const now = new Date();
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    labels.push(`${MONTH_SHORT[d.getMonth()]}`);
  }
  return labels;
}

export default function DashboardPage() {
  const { status, wallet } = useWallet();
  const { repayLoan, getPoolBalance, getPoolStats, isSending } =
    useLoanProgram();
  const walletAddress = wallet?.account.address;

  const [localRepayState, setLocalRepayState] = useState<LocalRepayMap>({});
  const [featuredLoanId, setFeaturedLoanId] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const loansQuery = useQuery({
    queryKey: ["loans", walletAddress],
    queryFn: () => getLoans(walletAddress!),
    enabled: status === "connected" && Boolean(walletAddress),
  });

  const riskScoreQuery = useQuery({
    queryKey: ["dashboard-score", walletAddress],
    queryFn: () => getRiskScore(walletAddress!),
    enabled: status === "connected" && Boolean(walletAddress),
  });

  const poolBalanceQuery = useQuery({
    queryKey: ["dashboard-pool-balance"],
    queryFn: getPoolBalance,
    enabled: status === "connected",
  });

  const poolStatsQuery = useQuery({
    queryKey: ["dashboard-pool-stats"],
    queryFn: getPoolStats,
    enabled: status === "connected",
    staleTime: 30_000,
    retry: 1,
  });

  const repayMutation = useMutation({
    mutationFn: async (loanId: string) => {
      if (!walletAddress) throw new Error("Wallet not connected");
      const pdaMap = getLoanPdaMap(walletAddress);
      const metadata = pdaMap[loanId];
      if (!metadata) {
        throw new Error(
          "Missing loan PDA metadata. Repayment for this loan is unavailable in this browser session."
        );
      }
      return repayLoan(
        metadata.loanPda,
        metadata.collateralPda,
        Number(metadata.loanIndex)
      );
    },
    onSuccess: (_, loanId) => {
      setLocalRepayState((prev) => ({ ...prev, [loanId]: true }));
      toast.success("Repayment transaction submitted.");
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(message || "Repayment failed.");
    },
  });

  const loansData = loansQuery.data;
  const loans = useMemo(() => loansData ?? [], [loansData]);

  const activeLoans = useMemo(
    () =>
      loans.map((loan) => ({
        ...loan,
        status:
          localRepayState[loan.id] && loan.status === "ACTIVE"
            ? "REPAID"
            : loan.status,
      })),
    [localRepayState, loans]
  );

  const solelyActive = useMemo(
    () =>
      activeLoans.filter((l) => normalizeStatus(l.status) === "ACTIVE"),
    [activeLoans]
  );

  const defaultFeaturedId = useMemo(() => {
    if (solelyActive.length === 0) return null;
    const sorted = [...solelyActive].sort(
      (a, b) => Number(a.dueTimestamp) - Number(b.dueTimestamp)
    );
    return sorted[0]!.id;
  }, [solelyActive]);

  const effectiveFeaturedId = useMemo(() => {
    if (solelyActive.length === 0) return null;
    if (
      featuredLoanId != null &&
      solelyActive.some((l) => l.id === featuredLoanId)
    ) {
      return featuredLoanId;
    }
    return defaultFeaturedId;
  }, [solelyActive, featuredLoanId, defaultFeaturedId]);

  const featuredLoan = useMemo(
    () =>
      effectiveFeaturedId == null
        ? null
        : (solelyActive.find((l) => l.id === effectiveFeaturedId) ?? null),
    [solelyActive, effectiveFeaturedId]
  );

  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 30_000);
    return (): void => clearInterval(id);
  }, []);

  const metrics = useMemo(() => {
    const active = activeLoans.filter(
      (l) => normalizeStatus(l.status) === "ACTIVE"
    );
    let loanedLamports = 0n;
    let collateralLamports = 0n;
    active.forEach((l) => {
      loanedLamports += BigInt(l.loanAmountLamports);
      collateralLamports += BigInt(l.collateralAmountLamports);
    });
    const ltvMultiplier =
      loanedLamports > 0n
        ? Number(collateralLamports) / Number(loanedLamports)
        : null;

    const nearestDueLoan = active.reduce<LoanRecord | null>((best, l) => {
      if (
        best == null ||
        Number(l.dueTimestamp) < Number(best.dueTimestamp)
      ) {
        return l;
      }
      return best;
    }, null);

    return {
      activeCount: active.length,
      loanedSol: Number(loanedLamports) / LAMPORTS_PER_SOL,
      collateralSol: Number(collateralLamports) / LAMPORTS_PER_SOL,
      ltvMultiplier,
      nearestDueLoan,
    };
  }, [activeLoans]);

  const score = riskScoreQuery.data?.score;
  const health = score != null ? creditHealthFromScore(Math.round(score)) : null;

  const poolBalSol =
    poolBalanceQuery.data != null
      ? Number(poolBalanceQuery.data) / LAMPORTS_PER_SOL
      : null;

  const tenorPct = featuredLoan ? tenorProgressPct(featuredLoan, nowMs) : 0;
  const principalSol = featuredLoan
    ? Number(featuredLoan.loanAmountLamports) / LAMPORTS_PER_SOL
    : 0;
  const interestEstimate = featuredLoan
    ? estimateSimpleInterestLamports(featuredLoan) / LAMPORTS_PER_SOL
    : 0;

  const nextDueTs = metrics.nearestDueLoan
    ? Number(metrics.nearestDueLoan.dueTimestamp) * 1000
    : null;
  const daysUntilDue =
    nextDueTs != null
      ? Math.ceil((nextDueTs - nowMs) / 86400_000)
      : null;

  const scoreBars = useMemo(() => {
    const current = score != null ? Math.round(score) : 50;
    const base = Math.max(20, current - 18);
    const steps = 6;
    const out: number[] = [];
    for (let i = 0; i < steps; i++) {
      const t = i / (steps - 1);
      out.push(Math.round(base + (current - base) * t));
    }
    return out;
  }, [score]);

  const monthLabels = useMemo(() => lastMonthsLabels(6), []);

  const repaidCount = useMemo(
    () =>
      activeLoans.filter((l) => normalizeStatus(l.status) === "REPAID")
        .length,
    [activeLoans]
  );

  const promoApr =
    riskScoreQuery.data?.terms.interestRateBps != null
      ? (riskScoreQuery.data.terms.interestRateBps / 100).toFixed(2)
      : "—";

  const recentRows = useMemo(() => {
    const sorted = [...activeLoans].sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
    return sorted.slice(0, 3);
  }, [activeLoans]);

  function handleStatement(): void {
    if (activeLoans.length === 0) {
      toast.error("No loan records to export.");
      return;
    }
    downloadTextFile("saathi-loan-statement.csv", buildLoanCsv(activeLoans));
    toast.success("Statement downloaded.");
  }

  if (status !== "connected") {
    return (
      <AppShell>
        <div className="mx-auto max-w-lg rounded-3xl border border-border bg-card p-10 text-center shadow-sm">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Connect your wallet
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Your loan dashboard, trust score, and pool context load after you
            connect.
          </p>
          <div className="mt-8 flex justify-center">
            <WalletButton
              disconnectedLabel="Connect Wallet"
              className="!rounded-full !border-0 !bg-primary !px-8 !py-3 !text-sm !font-semibold !text-primary-foreground shadow-sm hover:!bg-primary/90"
            />
          </div>
          <p className="mt-8 text-sm text-muted-foreground">
            <Link
              href="/borrow"
              className="font-semibold text-primary underline-offset-4 hover:underline"
            >
              Borrow
            </Link>{" "}
            ·{" "}
            <Link
              href="/lend"
              className="font-semibold text-primary underline-offset-4 hover:underline"
            >
              Lend
            </Link>
          </p>
        </div>
      </AppShell>
    );
  }

  const pdaMap = walletAddress ? getLoanPdaMap(walletAddress) : {};
  const canRepayFeatured =
    featuredLoan &&
    Boolean(pdaMap[featuredLoan.id]) &&
    normalizeStatus(featuredLoan.status) === "ACTIVE";

  return (
    <AppShell>
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-[1.65rem] font-bold tracking-tight text-foreground md:text-4xl md:font-semibold">
            Loan dashboard
          </h1>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            {health && score != null ? (
              <span
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-semibold ${
                  health.tone === "healthy"
                    ? "border-[var(--health)]/35 bg-[var(--health-muted)] text-[color:var(--health)]"
                    : health.tone === "watch"
                      ? "border-amber-400/40 bg-amber-400/15 text-amber-900 dark:text-amber-100"
                      : "border-destructive/35 bg-destructive/10 text-destructive"
                }`}
              >
                <BadgeCheck className="h-4 w-4 shrink-0" strokeWidth={2} />
                Credit Score: {health.label} · {Math.round(score)}
              </span>
            ) : riskScoreQuery.isLoading ? (
              <span className="h-9 w-48 animate-pulse rounded-full bg-secondary" />
            ) : (
              <span className="text-sm text-muted-foreground">
                Score unavailable
              </span>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={handleStatement}
          className="inline-flex h-11 shrink-0 items-center justify-center gap-2 self-start rounded-full border border-border bg-card px-5 text-sm font-semibold text-foreground shadow-sm transition hover:bg-accent"
        >
          <Download className="h-4 w-4" strokeWidth={2} />
          Statement
        </button>
      </div>

      <section className="mt-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm md:rounded-3xl md:p-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Pool Balance
          </p>
          <p className="mt-3 font-mono text-xl font-semibold tabular-nums md:text-2xl">
            {poolBalanceQuery.isLoading
              ? "…"
              : poolBalSol != null
                ? `${poolBalSol.toLocaleString(undefined, { maximumFractionDigits: 2 })} SOL`
                : "—"}
          </p>
          {poolStatsQuery.data?.apyEstimatePercent != null ? (
            <p className="mt-2 text-sm font-semibold text-[var(--health)]">
              +{poolStatsQuery.data.apyEstimatePercent.toFixed(1)}% est. pool
              yield
            </p>
          ) : (
            <p className="mt-2 text-xs text-muted-foreground">
              Live balance from the pool vault (RPC).
            </p>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm md:rounded-3xl md:p-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Active Loans
          </p>
          <p className="mt-3 font-mono text-xl font-semibold tabular-nums md:text-2xl">
            {metrics.loanedSol.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}{" "}
            SOL
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            {metrics.activeCount} outstanding loan
            {metrics.activeCount === 1 ? "" : "s"}
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm md:rounded-3xl md:p-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Locked Collateral
          </p>
          <p className="mt-3 font-mono text-xl font-semibold tabular-nums md:text-2xl">
            {metrics.collateralSol.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}{" "}
            SOL
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            {metrics.ltvMultiplier != null
              ? `${metrics.ltvMultiplier.toFixed(2)}× collateral vs principal`
              : "—"}
          </p>
        </div>

        <div
          className={`relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-sm md:rounded-3xl md:p-6 ${
            daysUntilDue != null && daysUntilDue <= 7
              ? "border-l-[5px] border-l-destructive border-border"
              : ""
          }`}
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Next Due Date
          </p>
          <p className="mt-3 text-xl font-semibold tabular-nums md:text-2xl">
            {nextDueTs != null
              ? new Date(nextDueTs).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })
              : "—"}
          </p>
          {daysUntilDue != null ? (
            <p
              className={`mt-2 text-sm font-semibold ${
                daysUntilDue <= 7 ? "text-destructive" : "text-muted-foreground"
              }`}
            >
              {daysUntilDue < 0
                ? "Overdue"
                : daysUntilDue === 0
                  ? "Due today"
                  : `Due in ${daysUntilDue} day${daysUntilDue === 1 ? "" : "s"}`}
            </p>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">
              No active schedules
            </p>
          )}
        </div>
      </section>

      <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <section className="rounded-3xl border border-border bg-card p-6 shadow-sm md:p-8">
          {featuredLoan ? (
            <>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-foreground md:text-xl">
                    Active Loan #{loanDisplaySuffix(featuredLoan.id)}
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Standard collateralized pool
                  </p>
                  {solelyActive.length > 1 ? (
                    <label className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="font-medium">Focus loan</span>
                      <select
                        value={effectiveFeaturedId ?? ""}
                        onChange={(e) => setFeaturedLoanId(e.target.value)}
                        className="rounded-lg border border-input bg-background px-2 py-1 text-[13px] text-foreground"
                      >
                        {solelyActive.map((l) => (
                          <option key={l.id} value={l.id}>
                            #{loanDisplaySuffix(l.id)} ·{" "}
                            {lamportsStringToSol(l.loanAmountLamports)} SOL
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                </div>
                <button
                  type="button"
                  disabled={
                    !canRepayFeatured || isSending || repayMutation.isPending
                  }
                  onClick={() =>
                    featuredLoan && repayMutation.mutate(featuredLoan.id)
                  }
                  className="inline-flex min-h-[2.75rem] shrink-0 items-center justify-center rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {repayMutation.isPending ? "Submitting…" : "Repay"}
                </button>
              </div>

              <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Amount
                  </p>
                  <p className="mt-1 font-mono text-lg font-semibold tabular-nums">
                    {lamportsStringToSol(featuredLoan.loanAmountLamports)} SOL
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Collateral
                  </p>
                  <p className="mt-1 font-mono text-lg font-semibold tabular-nums">
                    {lamportsStringToSol(featuredLoan.collateralAmountLamports)}{" "}
                    SOL
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Interest rate
                  </p>
                  <p className="mt-1 font-mono text-lg font-semibold tabular-nums text-primary">
                    {(featuredLoan.interestBps / 100).toFixed(2)}%
                  </p>
                  <span className="text-[11px] text-muted-foreground">APR est.</span>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Due date
                  </p>
                  <p className="mt-1 text-lg font-semibold tabular-nums">
                    {new Date(
                      Number(featuredLoan.dueTimestamp) * 1000
                    ).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </p>
                </div>
              </div>

              <div className="mt-10">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-foreground">
                    Repayment progress
                  </p>
                  <span className="font-mono text-sm font-bold text-primary">
                    {tenorPct}%
                  </span>
                </div>
                <div className="mt-3 h-3 overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full bg-primary transition-[width] duration-500"
                    style={{ width: `${tenorPct}%` }}
                  />
                </div>
                <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                  Elapsed share of the loan term (on-chain repayment is a single
                  settlement for this MVP).
                </p>
              </div>
            </>
          ) : (
            <div className="py-6 text-center">
              <p className="text-lg font-semibold text-foreground">
                No active loan
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Open a position from the borrow flow to see it here.
              </p>
              <Link
                href="/borrow"
                className="mt-6 inline-flex rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground"
              >
                Go to Borrow
              </Link>
            </div>
          )}
        </section>

        <section className="rounded-3xl border border-border bg-card p-6 shadow-sm md:p-8">
          <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
            Score history
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Illustrative trend toward your current trust score
          </p>
          <div className="mt-8 flex h-44 items-end justify-between gap-2">
            {scoreBars.map((v, i) => {
              const h = Math.max(12, (v / 100) * 100);
              const warm = i >= scoreBars.length - 2;
              return (
                <div
                  key={i}
                  className="flex flex-1 flex-col items-center gap-2"
                >
                  <div
                    className={`w-full max-w-10 rounded-t-md transition-colors ${
                      warm
                        ? "bg-gradient-to-t from-primary to-[#e07a5f]"
                        : "bg-[color-mix(in_srgb,var(--accent)_70%,white)]"
                    }`}
                    style={{ height: `${h}%`, minHeight: 28 }}
                  />
                  <span className="text-[10px] font-medium text-muted-foreground">
                    {monthLabels[i] ?? ""}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <section className="rounded-3xl border border-border bg-card p-6 shadow-sm md:p-8">
          <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
            Liability projection
          </h2>
          <div className="mt-4 flex flex-wrap items-center gap-4 text-xs font-medium">
            <span className="inline-flex items-center gap-1.5 text-foreground">
              <span className="h-2 w-2 rounded-full bg-primary" />
              Total owed (est.)
            </span>
            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
              <span className="h-0.5 w-4 border-t-2 border-dashed border-[color-mix(in_srgb,var(--accent)_60%,var(--foreground))]" />
              Principal
            </span>
          </div>
          <div className="relative mt-8 h-48 w-full">
            <svg
              className="h-full w-full text-primary"
              viewBox="0 0 320 120"
              preserveAspectRatio="none"
              aria-hidden
            >
              <defs>
                <linearGradient id="liabFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="currentColor" stopOpacity="0.22" />
                  <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path
                d="M0,90 L55,88 L110,82 L165,72 L220,55 L275,38 L320,22 L320,120 L0,120 Z"
                fill="url(#liabFill)"
              />
              <path
                d="M0,90 L55,88 L110,82 L165,72 L220,55 L275,38 L320,22"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
              <path
                d="M0,95 L320,95"
                fill="none"
                stroke="currentColor"
                strokeOpacity="0.28"
                strokeWidth="1.5"
                strokeDasharray="5 5"
              />
            </svg>
            <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-between text-[10px] text-muted-foreground">
              {monthLabels.map((m) => (
                <span key={m}>{m}</span>
              ))}
            </div>
          </div>
          {featuredLoan ? (
            <p className="mt-4 text-xs text-muted-foreground">
              Featured loan: ~{(principalSol + interestEstimate).toFixed(4)} SOL
              total estimated obligation (principal + simple interest) vs{" "}
              {principalSol.toFixed(4)} SOL principal.
            </p>
          ) : null}
        </section>

        <div className="space-y-6">
          <section className="rounded-3xl bg-primary px-6 py-7 text-primary-foreground shadow-md md:px-7 md:py-8">
            <h2 className="text-lg font-bold">
              Unlock {promoApr}% APR
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-primary-foreground/90">
              Pay your next three repayments on time to stay in the best rate
              tier for your profile.
            </p>
            <div className="mt-5">
              <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-primary-foreground/85">
                <span>On-time streak</span>
                <span>
                  {Math.min(3, repaidCount)} / 3
                </span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-primary-foreground/25">
                <div
                  className="h-full rounded-full bg-primary-foreground"
                  style={{
                    width: `${Math.min(100, (Math.min(3, repaidCount) / 3) * 100)}%`,
                  }}
                />
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-border bg-card p-6 shadow-sm">
            <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
              Recent activity
            </h2>
            <ul className="mt-5 space-y-4">
              {recentRows.map((row) => {
                const isRepaid = normalizeStatus(row.status) === "REPAID";
                const days = Math.round(
                  (nowMs - new Date(row.updatedAt).getTime()) / 86400_000
                );
                const ago =
                  days <= 0
                    ? "Today"
                    : days === 1
                      ? "1 day ago"
                      : `${days} days ago`;
                return (
                  <li key={row.id} className="flex gap-3">
                    <span
                      className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                        isRepaid
                          ? "bg-[var(--health-muted)] text-[color:var(--health)]"
                          : "bg-secondary text-primary"
                      }`}
                    >
                      {isRepaid ? (
                        <CheckCircle2 className="h-4 w-4" strokeWidth={2} />
                      ) : (
                        <Plus className="h-4 w-4" strokeWidth={2} />
                      )}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">
                        {isRepaid ? "Loan repaid" : "Loan opened"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {lamportsStringToSol(row.loanAmountLamports)} SOL · {ago}
                      </p>
                    </div>
                  </li>
                );
              })}
              {riskScoreQuery.data != null ? (
                <li className="flex gap-3">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-primary">
                    <TrendingUp className="h-4 w-4" strokeWidth={2} aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">
                      Score refreshed
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Trust score {Math.round(riskScoreQuery.data.score)} · live
                      from Saathi indexer
                    </p>
                  </div>
                </li>
              ) : null}
            </ul>
            <Link
              href="#all-loans"
              className="mt-6 inline-block text-sm font-semibold text-primary underline-offset-4 hover:underline"
            >
              View all history
            </Link>
          </section>
        </div>
      </div>

      <details
        id="all-loans"
        className="group mt-14 rounded-3xl border border-border bg-card shadow-sm"
      >
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-6 py-5 font-semibold text-foreground md:px-8 [&::-webkit-details-marker]:hidden">
          <span>All loans</span>
          <ChevronDown className="h-5 w-5 shrink-0 text-muted-foreground transition group-open:rotate-180" />
        </summary>
        <div className="border-t border-border px-6 pb-6 pt-2 md:px-8">
          {loansQuery.isLoading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Loading…
            </p>
          ) : loansQuery.isError ? (
            <p className="py-8 text-center text-sm text-destructive">
              Unable to fetch loans.{" "}
              <button
                type="button"
                onClick={() => loansQuery.refetch()}
                className="font-semibold underline"
              >
                Retry
              </button>
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="py-3 pr-4">Loan</th>
                    <th className="py-3 pr-4">Amount</th>
                    <th className="py-3 pr-4">Status</th>
                    <th className="py-3 pr-4">Due</th>
                    <th className="py-3">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {activeLoans.map((loan) => {
                    const canRepay =
                      Boolean(pdaMap[loan.id]) &&
                      normalizeStatus(loan.status) === "ACTIVE";
                    return (
                      <tr
                        key={loan.id}
                        className="border-t border-border/70"
                      >
                        <td className="py-3 pr-4 font-mono text-xs">
                          #{loanDisplaySuffix(loan.id)}
                        </td>
                        <td className="py-3 pr-4 font-mono tabular-nums">
                          {lamportsStringToSol(loan.loanAmountLamports)} SOL
                        </td>
                        <td className="py-3 pr-4">
                          {normalizeStatus(loan.status)}
                        </td>
                        <td className="py-3 pr-4 text-muted-foreground">
                          {new Date(
                            Number(loan.dueTimestamp) * 1000
                          ).toLocaleDateString()}
                        </td>
                        <td className="py-3">
                          <button
                            type="button"
                            disabled={
                              !canRepay ||
                              isSending ||
                              repayMutation.isPending
                            }
                            onClick={() => repayMutation.mutate(loan.id)}
                            className="rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
                          >
                            Repay
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </details>
    </AppShell>
  );
}
