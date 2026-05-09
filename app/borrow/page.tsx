"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Info, Lightbulb } from "lucide-react";
import { AppShell } from "../components/app-shell";
import { BorrowStepper } from "../components/borrow-stepper";
import { RiskScoreGauge } from "../components/risk-score-gauge";
import { WalletButton } from "../components/wallet-button";
import {
  ApiClientError,
  getRiskScore,
  requestLoan,
  type RiskScoreBreakdown,
} from "../lib/api";
import { saveLoanPdaRecord } from "../lib/loan-local";
import { useWallet } from "../lib/wallet/context";
import { useLoanProgram } from "../lib/hooks/use-loan-program";

const LAMPORTS_PER_SOL = 1_000_000_000;
const DURATIONS = [7, 14, 30, 60, 90];
const INTEREST_PREVIEW_BARS = 8;

function lamportsToSol(lamports: number): number {
  return lamports / LAMPORTS_PER_SOL;
}

function toLamports(value: number): number {
  return Math.round(value * LAMPORTS_PER_SOL);
}

function formatSol(value: number): string {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: value < 1 ? 4 : 2,
    maximumFractionDigits: 4,
  });
}

function labelize(key: keyof RiskScoreBreakdown): string {
  switch (key) {
    case "walletAge":
      return "Wallet Age";
    case "solBalance":
      return "SOL Balance";
    case "txVolume":
      return "Transaction Volume";
    case "repaymentHistory":
      return "Repayment History";
    case "defiActivity":
      return "DeFi Activity";
    default:
      return key;
  }
}

function formatDurationDays(days: number): string {
  switch (days) {
    case 7:
      return "1 Week";
    case 14:
      return "2 Weeks";
    case 30:
      return "~1 Month";
    case 60:
      return "~2 Months";
    case 90:
      return "~3 Months";
    default:
      return `${days} Days`;
  }
}

function trustStandingLabel(score: number): string {
  if (score >= 85) return "Excellent Standing";
  if (score >= 70) return "Strong Standing";
  if (score >= 55) return "Fair Standing";
  if (score >= 40) return "Building Standing";
  return "Needs Improvement";
}

type InterestAccrualPreviewProps = {
  principalLamports: number;
  interestRateBps: number;
  durationDays: number;
};

function InterestAccrualPreview({
  principalLamports,
  interestRateBps,
  durationDays,
}: InterestAccrualPreviewProps) {
  const fractions = useMemo(() => {
    const values: number[] = [];
    let peak = 1;
    for (let i = 1; i <= INTEREST_PREVIEW_BARS; i += 1) {
      const timeFraction = i / INTEREST_PREVIEW_BARS;
      const accrued =
        principalLamports *
        (interestRateBps / 10_000) *
        ((durationDays * timeFraction) / 365);
      values.push(accrued);
      peak = Math.max(peak, accrued);
    }
    return values.map((v) => (peak <= 0 ? 0 : (v / peak) * 100));
  }, [durationDays, interestRateBps, principalLamports]);

  return (
    <div className="mt-7">
      <p className="text-sm font-semibold text-foreground">
        Projected interest accrual
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Approximate accrued interest assuming simple accrual over the term.
      </p>
      <div
        className="mt-4 flex h-28 items-end justify-between gap-1.5 sm:gap-2"
        role="img"
        aria-label="Projected interest accrual gradient chart"
      >
        {fractions.map((pct, idx) => {
          const hueMix = idx / Math.max(1, fractions.length - 1);
          return (
            <div
              key={idx}
              className="flex min-w-0 flex-1 flex-col justify-end rounded-md bg-accent/70"
              style={{ height: "100%" }}
            >
              <div
                className="mx-auto w-full max-w-[2.25rem] min-w-[0.375rem] rounded-md"
                style={{
                  height: `${Math.max(8, pct)}%`,
                  background: `linear-gradient(to top,
                    rgba(253,210,200,${0.85 - hueMix * 0.25}),
                    hsla(${18 - hueMix * 6}, ${58 + hueMix * 10}%, ${45 + hueMix * 8}%, 0.92))`,
                }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function BorrowPage() {
  const router = useRouter();
  const { status, wallet } = useWallet();
  const { createLoan, getPoolBalance, isSending } = useLoanProgram();

  const walletAddress = wallet?.account.address;
  const [loanAmountSol, setLoanAmountSol] = useState("0.25");
  const [durationDays, setDurationDays] = useState(14);
  const [borrowClockBaselineMs] = useState(() => Date.now());

  const scoreQuery = useQuery({
    queryKey: ["risk-score", walletAddress],
    queryFn: () => getRiskScore(walletAddress!),
    enabled: status === "connected" && Boolean(walletAddress),
    staleTime: 60_000,
    retry: 0,
  });

  const poolBalanceQuery = useQuery({
    queryKey: ["pool-balance"],
    queryFn: getPoolBalance,
    enabled: status === "connected",
    staleTime: 20_000,
    retry: 0,
  });

  const loanMutation = useMutation({
    mutationFn: requestLoan,
  });

  const loanAmount = Number(loanAmountSol);
  const validAmount = Number.isFinite(loanAmount) && loanAmount > 0;
  const scoreData = scoreQuery.data;

  const availableDurations = useMemo(() => {
    const maxDuration = scoreData?.terms.maxDurationDays ?? 0;
    return DURATIONS.filter((value) => value <= maxDuration);
  }, [scoreData]);

  const loanAmountLamports = validAmount ? toLamports(loanAmount) : 0;
  const ltv = scoreData?.terms.ltv ?? 0;
  const collateralLamports =
    ltv > 0 && loanAmountLamports > 0 ? Math.ceil(loanAmountLamports / ltv) : 0;
  const interestLamports = Math.ceil(
    (loanAmountLamports * (scoreData?.terms.interestRateBps ?? 0)) / 10000
  );
  const dueDate = useMemo(
    () => new Date(borrowClockBaselineMs + durationDays * 86400_000),
    [borrowClockBaselineMs, durationDays]
  );
  const maxLoanLamports = Number(poolBalanceQuery.data ?? 0n);

  const amountExceedsPool = loanAmountLamports > maxLoanLamports;
  const poolBalanceError =
    poolBalanceQuery.error instanceof Error
      ? poolBalanceQuery.error.message
      : null;
  const canSubmit =
    Boolean(scoreData?.terms.approved) &&
    validAmount &&
    !amountExceedsPool &&
    !loanMutation.isPending &&
    !isSending &&
    !poolBalanceQuery.isError;

  const collateralMultiple =
    loanAmountLamports > 0
      ? collateralLamports / loanAmountLamports
      : 0;

  const healthLabel =
    collateralMultiple >= 1.6
      ? `Safe (${collateralMultiple.toFixed(1)}x)`
      : collateralMultiple >= 1.25
        ? `Caution (${collateralMultiple.toFixed(1)}x)`
        : `Tight (${collateralMultiple.toFixed(1)}x)`;

  const healthPct = Math.round(
    Math.min(
      100,
      collateralMultiple <= 0
        ? 0
        : Math.min(((collateralMultiple - 1) / 2.5) * 100 + 35, 100)
    )
  );

  const scoreErrorMessage =
    scoreQuery.error instanceof ApiClientError && scoreQuery.error.isRateLimited
      ? "RPC is temporarily rate-limited. Wait a few seconds and retry."
      : scoreQuery.error instanceof Error
        ? scoreQuery.error.message
        : "Try again in a moment.";

  const borrowStep = useMemo((): 1 | 2 | 3 => {
    if (loanMutation.isPending || isSending) {
      return 3;
    }
    if (!scoreData) {
      return 1;
    }
    return 2;
  }, [loanMutation.isPending, isSending, scoreData]);

  async function handleRequestLoan() {
    if (!walletAddress || !scoreData || !canSubmit) {
      if (poolBalanceQuery.isError) {
        toast.error("Pool liquidity unavailable. Retry after refreshing.");
      }
      return;
    }

    const txToast = toast.loading("Approve transaction in Phantom...");

    try {
      const loanResponse = await loanMutation.mutateAsync({
        walletAddress,
        loanAmountLamports,
        durationDays,
      });

      const txResult = await createLoan({
        loanAmountLamports: BigInt(loanAmountLamports),
        collateralAmountLamports: BigInt(loanResponse.collateralRequired),
        interestRateBps: loanResponse.terms.interestRateBps,
        durationDays,
      });

      saveLoanPdaRecord(walletAddress, {
        loanId: loanResponse.loanId,
        loanPda: txResult.loanPda,
        collateralPda: txResult.collateralPda,
        loanIndex: txResult.loanIndex.toString(),
      });

      toast.success("Loan disbursed! Check your wallet.", { id: txToast });
      router.push("/dashboard");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(message || "Loan request failed", { id: txToast });
    }
  }

  return (
    <AppShell>
      <div className="mb-10">
        <h1 className="font-serif text-3xl font-semibold tracking-tight text-foreground md:text-[2.125rem]">
          Borrow against your reputation
        </h1>
        <BorrowStepper currentStep={borrowStep} />
      </div>

      {status !== "connected" && (
        <section className="rounded-3xl border border-border bg-card p-10 text-center shadow-sm md:p-12">
          <h2 className="text-xl font-semibold tracking-tight text-foreground">
            Connect Wallet to Continue
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">
            Trust scoring analyzes your Solana wallet history. Connect a wallet
            to load your Saathi Loan profile.
          </p>
          <div className="mt-8 flex justify-center">
            <WalletButton
              disconnectedLabel="Connect Wallet"
              className="!rounded-full !border-0 !bg-primary !px-8 !py-3 !text-sm !font-semibold !text-primary-foreground shadow-sm hover:!bg-primary/90"
            />
          </div>
        </section>
      )}

      {status === "connected" && (
        <div className="grid gap-8 lg:grid-cols-[minmax(280px,1fr)_minmax(0,1.05fr)]">
          <section className="rounded-3xl border border-border bg-card p-7 shadow-sm md:p-8">
            {scoreQuery.isLoading && (
              <div className="space-y-6">
                <div className="mx-auto flex h-56 max-w-[14rem] animate-pulse rounded-full bg-secondary/80" />
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="h-3 animate-pulse rounded-full bg-secondary" />
                  ))}
                </div>
              </div>
            )}

            {scoreQuery.isError && (
              <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-5 text-sm">
                <p className="font-semibold text-destructive">
                  Could not fetch score.
                </p>
                <p className="mt-2 text-muted-foreground">{scoreErrorMessage}</p>
                <button
                  type="button"
                  onClick={() => scoreQuery.refetch()}
                  className="mt-4 rounded-full bg-secondary px-4 py-2 text-xs font-semibold text-secondary-foreground"
                >
                  Retry
                </button>
              </div>
            )}

            {scoreData && (
              <div className="space-y-8">
                <div className="flex flex-col items-center">
                  <RiskScoreGauge score={Math.round(scoreData.score)} />
                  <p className="mt-6 rounded-full bg-[var(--tip-bg)] px-4 py-1.5 text-sm font-semibold text-primary">
                    {trustStandingLabel(Math.round(scoreData.score))}
                  </p>
                </div>

                <div className="space-y-4">
                  {(
                    Object.keys(scoreData.breakdown) as (keyof RiskScoreBreakdown)[]
                  ).map((key) => {
                    const value = scoreData.breakdown[key];
                    const max =
                      key === "repaymentHistory"
                        ? 30
                        : key === "defiActivity"
                          ? 10
                          : 20;
                    const pct = Math.round(
                      Math.min(100, (value / Math.max(max, 0.001)) * 100)
                    );
                    return (
                      <div key={key} className="space-y-2">
                        <div className="flex items-center justify-between text-[13px]">
                          <span className="text-muted-foreground">
                            {labelize(key)}
                          </span>
                          <span className="font-semibold tabular-nums text-foreground">
                            {pct}%
                          </span>
                        </div>
                        <div className="h-2.5 rounded-full bg-secondary">
                          <div
                            className="h-full rounded-full bg-primary transition-[width] duration-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex gap-3 rounded-2xl border border-border bg-[var(--tip-bg)]/80 p-4">
                    <Lightbulb
                      className="mt-0.5 h-5 w-5 shrink-0 text-primary"
                      aria-hidden
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">
                        Boost Score
                      </p>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        Link your Twitter account to increase credit by five
                        points (coming soon).
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-3 rounded-2xl border border-border bg-[var(--tip-bg)]/80 p-4">
                    <Info
                      className="mt-0.5 h-5 w-5 shrink-0 text-primary"
                      aria-hidden
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">
                        Repayment Tip
                      </p>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        Automate repayments early to protect your repayment
                        history multiplier.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </section>

          <section className="rounded-3xl border border-border bg-card p-7 shadow-sm md:p-8">
            <h2 className="text-lg font-semibold tracking-tight text-foreground md:text-xl">
              Loan Details
            </h2>

            {scoreData && (
              <div className="mt-6 grid gap-4 sm:grid-cols-3">
                <div className="rounded-2xl border border-border bg-background/80 px-4 py-3 text-center md:text-left">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Max LTV
                  </p>
                  <p className="mt-1 font-mono text-lg font-semibold tabular-nums text-foreground">
                    {(scoreData.terms.ltv * 100).toFixed(0)}%
                  </p>
                </div>
                <div className="rounded-2xl border border-border bg-background/80 px-4 py-3 text-center md:text-left">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Interest Rate
                  </p>
                  <p className="mt-1 font-mono text-lg font-semibold tabular-nums text-foreground">
                    {(scoreData.terms.interestRateBps / 100).toFixed(2)}%
                  </p>
                </div>
                <div className="rounded-2xl border border-border bg-background/80 px-4 py-3 text-center md:text-left">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Max Duration
                  </p>
                  <p className="mt-1 font-mono text-lg font-semibold tabular-nums text-foreground">
                    {scoreData.terms.maxDurationDays}d
                  </p>
                </div>
              </div>
            )}

            {scoreData && !scoreData.terms.approved && (
              <div className="mt-6 rounded-2xl border border-destructive/35 bg-destructive/10 p-5">
                <h3 className="font-semibold text-destructive">
                  Score below MVP threshold
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Accounts below the minimum Saathi Loan score are paused in
                  this release. Continue building repayment history on Solana,
                  then try again.
                </p>
              </div>
            )}

            {scoreData?.terms.approved && (
              <form
                className="mt-8 space-y-6"
                onSubmit={(event) => {
                  event.preventDefault();
                  void handleRequestLoan();
                }}
              >
                <div className="space-y-2">
                  <label
                    htmlFor="loan-amount"
                    className="text-sm font-medium text-foreground"
                  >
                    Loan Amount (SOL)
                  </label>
                  <div className="relative">
                    <input
                      id="loan-amount"
                      type="text"
                      inputMode="decimal"
                      autoComplete="off"
                      placeholder="0.00"
                      value={loanAmountSol}
                      onChange={(event) => setLoanAmountSol(event.target.value)}
                      className="h-12 w-full rounded-2xl border border-input bg-background pr-14 pl-4 text-[15px] shadow-inner outline-none transition focus:border-primary/50 focus:ring-[3px] focus:ring-primary/15"
                    />
                    <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm font-semibold text-muted-foreground">
                      SOL
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs text-muted-foreground">
                      Pool liquidity:{" "}
                      <span className="font-semibold text-foreground">
                        {formatSol(lamportsToSol(maxLoanLamports))} SOL
                      </span>
                    </p>
                    {poolBalanceError ? (
                      <p className="text-xs font-medium text-destructive">
                        Could not load pool liquidity: {poolBalanceError}
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="space-y-2">
                  <label htmlFor="duration" className="text-sm font-medium">
                    Duration
                  </label>
                  <div className="relative">
                    <select
                      id="duration"
                      value={durationDays}
                      onChange={(event) =>
                        setDurationDays(Number(event.target.value))
                      }
                      className="h-12 w-full cursor-pointer appearance-none rounded-2xl border border-input bg-background px-4 pr-10 text-[15px] shadow-inner outline-none transition focus:border-primary/50 focus:ring-[3px] focus:ring-primary/15"
                    >
                      {availableDurations.map((days) => (
                        <option key={days} value={days}>
                          {formatDurationDays(days)}
                        </option>
                      ))}
                    </select>
                    <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-muted-foreground">
                      ⌄
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Choices are capped by your max duration eligibility.
                  </p>
                </div>

                <div className="space-y-3 rounded-2xl border border-border bg-background/70 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-medium text-muted-foreground">
                      Collateral Health
                    </p>
                    <p className="text-sm font-semibold text-primary">{healthLabel}</p>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-[var(--health-muted)]">
                    <div
                      className="h-full rounded-full bg-[var(--health)] transition-[width] duration-500"
                      style={{ width: `${healthPct}%` }}
                    />
                  </div>

                  <div className="mt-4 grid gap-3 pt-3 text-[13px] sm:grid-cols-3">
                    <div>
                      <p className="text-muted-foreground">Collateral Locked</p>
                      <p className="font-mono font-semibold tabular-nums">
                        {formatSol(lamportsToSol(collateralLamports))} SOL
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Due</p>
                      <p>{dueDate.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Total Repayment</p>
                      <p className="font-mono font-semibold tabular-nums">
                        {formatSol(
                          lamportsToSol(loanAmountLamports + interestLamports)
                        )}{" "}
                        SOL
                      </p>
                    </div>
                  </div>
                </div>

                {validAmount && loanAmountLamports > 0 ? (
                  <InterestAccrualPreview
                    principalLamports={loanAmountLamports}
                    interestRateBps={scoreData.terms.interestRateBps}
                    durationDays={durationDays}
                  />
                ) : null}

                {amountExceedsPool ? (
                  <p className="text-sm font-medium text-destructive">
                    Requested amount exceeds available pool liquidity.
                  </p>
                ) : null}

                <button
                  type="submit"
                  disabled={!canSubmit}
                  className="inline-flex min-h-[3.35rem] w-full items-center justify-center rounded-full bg-primary px-6 py-3 text-[15px] font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-55"
                >
                  {loanMutation.isPending || isSending
                    ? "Confirm in wallet..."
                    : "Sign & receive SOL"}
                </button>
              </form>
            )}

            {!scoreQuery.isLoading && !scoreData && (
              <div className="mt-8 rounded-2xl border border-border bg-background/70 p-5 text-sm text-muted-foreground">
                Score unavailable. Refresh and try again, or revisit after the
                network stabilizes.
              </div>
            )}
          </section>
        </div>
      )}

      <p className="mt-14 text-center text-sm text-muted-foreground">
        New to Saathi Loan? Explore the protocol on the{" "}
        <Link href="/" className="font-semibold text-primary underline-offset-4 hover:underline">
          home page
        </Link>
        .
      </p>
    </AppShell>
  );
}
