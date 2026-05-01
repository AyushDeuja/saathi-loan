"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { AppShell } from "../components/app-shell";
import { PageHeader } from "../components/page-header";
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

export default function BorrowPage() {
  const router = useRouter();
  const { status, wallet } = useWallet();
  const { createLoan, getPoolBalance, isSending } = useLoanProgram();

  const walletAddress = wallet?.account.address;
  const [loanAmountSol, setLoanAmountSol] = useState("0.25");
  const [durationDays, setDurationDays] = useState(14);

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
  const dueDate = new Date(Date.now() + durationDays * 86400_000);
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

  const scoreErrorMessage =
    scoreQuery.error instanceof ApiClientError && scoreQuery.error.isRateLimited
      ? "RPC is temporarily rate-limited. Wait a few seconds and retry."
      : scoreQuery.error instanceof Error
        ? scoreQuery.error.message
        : "Try again in a moment.";

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
      <PageHeader
        eyebrow="Borrow flow"
        title="Borrow against your reputation"
        accent="Instant limits from your on-chain history."
        description="Phase 1: score analysis. Phase 2: configure loan terms. Phase 3: sign and receive SOL."
      />

        {status !== "connected" && (
          <section className="rounded-xl border border-border bg-card p-8 text-center">
            <h2 className="text-xl font-medium">Connect Wallet to Continue</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Risk scoring requires your public wallet activity on Solana.
            </p>
            <div className="mt-5 flex justify-center">
              <WalletButton
                disconnectedLabel="Connect Wallet"
                className="h-11 px-5 text-sm"
              />
            </div>
          </section>
        )}

        {status === "connected" && (
          <div className="grid gap-8 lg:grid-cols-[360px_1fr]">
            <section className="rounded-xl border border-border bg-card p-6 md:p-7">
              <h2 className="border-b border-border/70 pb-3 text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Step 1 · Risk score
              </h2>

              {scoreQuery.isLoading && (
                <div className="mt-4 space-y-3">
                  <div className="h-48 animate-pulse rounded-lg bg-secondary" />
                  <div className="h-3 w-1/2 animate-pulse rounded bg-secondary" />
                  <div className="h-3 w-2/3 animate-pulse rounded bg-secondary" />
                </div>
              )}

              {scoreQuery.isError && (
                <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm">
                  <p className="font-medium text-destructive">
                    Could not fetch score.
                  </p>
                  <p className="mt-1 text-muted-foreground">
                    {scoreErrorMessage}
                  </p>
                  <button
                    type="button"
                    onClick={() => scoreQuery.refetch()}
                    className="mt-3 rounded-md bg-secondary px-3 py-2 text-xs font-medium"
                  >
                    Retry
                  </button>
                </div>
              )}

              {scoreData && (
                <div className="mt-4 space-y-5">
                  <div className="flex justify-center">
                    <RiskScoreGauge score={Math.round(scoreData.score)} />
                  </div>
                  <div className="space-y-3">
                    {(
                      Object.keys(
                        scoreData.breakdown
                      ) as (keyof RiskScoreBreakdown)[]
                    ).map((key) => {
                      const value = scoreData.breakdown[key];
                      const max =
                        key === "repaymentHistory"
                          ? 30
                          : key === "defiActivity"
                            ? 10
                            : 20;
                      const width = Math.min(100, (value / max) * 100);

                      return (
                        <div key={key} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">
                              {labelize(key)}
                            </span>
                            <span className="font-mono tabular-nums">
                              {value.toFixed(1)}
                            </span>
                          </div>
                          <div className="h-2 rounded-full bg-secondary">
                            <div
                              className="h-2 rounded-full bg-primary transition-all duration-500"
                              style={{ width: `${width}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </section>

            <section className="rounded-xl border border-border bg-card p-6 md:p-7">
              <h2 className="border-b border-border/70 pb-3 text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Step 2 · Configure loan
              </h2>

              {scoreData && (
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <div className="rounded-lg border border-border bg-background p-3">
                    <p className="text-xs text-muted-foreground">LTV</p>
                    <p className="mt-1 font-mono text-lg tabular-nums">
                      {(scoreData.terms.ltv * 100).toFixed(0)}%
                    </p>
                  </div>
                  <div className="rounded-lg border border-border bg-background p-3">
                    <p className="text-xs text-muted-foreground">Interest</p>
                    <p className="mt-1 font-mono text-lg tabular-nums">
                      {(scoreData.terms.interestRateBps / 100).toFixed(2)}%
                    </p>
                  </div>
                  <div className="rounded-lg border border-border bg-background p-3">
                    <p className="text-xs text-muted-foreground">
                      Max Duration
                    </p>
                    <p className="mt-1 font-mono text-lg tabular-nums">
                      {scoreData.terms.maxDurationDays}d
                    </p>
                  </div>
                </div>
              )}

              {scoreData && !scoreData.terms.approved && (
                <div className="mt-5 rounded-lg border border-destructive/30 bg-destructive/10 p-4">
                  <h3 className="font-medium text-destructive">
                    Insufficient credit score
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Accounts below score 20 are blocked for this MVP. Build more
                    on-chain history and retry.
                  </p>
                </div>
              )}

              {scoreData?.terms.approved && (
                <form
                  className="mt-5 space-y-4"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void handleRequestLoan();
                  }}
                >
                  <div className="space-y-1.5">
                    <label
                      htmlFor="loan-amount"
                      className="text-sm font-medium"
                    >
                      Loan amount (SOL)
                    </label>
                    <input
                      id="loan-amount"
                      type="text"
                      inputMode="decimal"
                      autoComplete="off"
                      value={loanAmountSol}
                      onChange={(event) => setLoanAmountSol(event.target.value)}
                      className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm"
                    />
                    <p className="text-xs text-muted-foreground">
                      Pool liquidity:{" "}
                      {formatSol(lamportsToSol(maxLoanLamports))} SOL
                    </p>
                    {poolBalanceError ? (
                      <p className="mt-1 text-xs text-destructive">
                        Could not read pool liquidity: {poolBalanceError}
                      </p>
                    ) : null}
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="duration" className="text-sm font-medium">
                      Duration
                    </label>
                    <select
                      id="duration"
                      value={durationDays}
                      onChange={(event) =>
                        setDurationDays(Number(event.target.value))
                      }
                      className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm"
                    >
                      {availableDurations.map((days) => (
                        <option key={days} value={days}>
                          {days} days
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="rounded-lg border border-border bg-background p-4 text-sm">
                    <p className="text-muted-foreground">Collateral Required</p>
                    <p className="mt-1 font-mono tabular-nums">
                      {formatSol(lamportsToSol(collateralLamports))} SOL
                    </p>

                    <p className="mt-3 text-muted-foreground">
                      Total Repayment
                    </p>
                    <p className="mt-1 font-mono tabular-nums">
                      {formatSol(
                        lamportsToSol(loanAmountLamports + interestLamports)
                      )}{" "}
                      SOL
                    </p>

                    <p className="mt-3 text-muted-foreground">Due Date</p>
                    <p className="mt-1">{dueDate.toLocaleString()}</p>
                  </div>

                  {amountExceedsPool && (
                    <p className="text-sm text-destructive">
                      Requested amount exceeds available pool liquidity.
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={!canSubmit}
                    className="inline-flex h-11 items-center rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {loanMutation.isPending || isSending
                      ? "Processing..."
                      : "Request Loan"}
                  </button>
                </form>
              )}

              {!scoreQuery.isLoading && !scoreData && (
                <div className="mt-4 rounded-lg border border-border bg-background p-4 text-sm text-muted-foreground">
                  Score unavailable. Refresh and try again.
                </div>
              )}
            </section>
          </div>
        )}

      <footer className="mt-8 text-sm text-muted-foreground">
        Need context first? Go back to{" "}
        <Link href="/" className="underline">
          landing
        </Link>
        .
      </footer>
    </AppShell>
  );
}
