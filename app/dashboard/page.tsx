"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { AppShell } from "../components/app-shell";
import { PageHeader } from "../components/page-header";
import { WalletButton } from "../components/wallet-button";
import { LoanCard } from "../components/loan-card";
import { getLoans, getRiskScore } from "../lib/api";
import { getLoanPdaMap } from "../lib/loan-local";
import { useWallet } from "../lib/wallet/context";
import { useLoanProgram } from "../lib/hooks/use-loan-program";

type LocalRepayMap = Record<string, boolean>;

const LAMPORTS_PER_SOL = 1_000_000_000;

function lamportsStringToSol(value: string): string {
  const numeric = Number(value) / LAMPORTS_PER_SOL;
  return numeric.toLocaleString(undefined, {
    minimumFractionDigits: numeric < 1 ? 4 : 2,
    maximumFractionDigits: 4,
  });
}

export default function DashboardPage() {
  const { status, wallet } = useWallet();
  const { repayLoan, getPoolBalance, isSending } = useLoanProgram();
  const walletAddress = wallet?.account.address;

  const [localRepayState, setLocalRepayState] = useState<LocalRepayMap>({});

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

  const repayMutation = useMutation({
    mutationFn: async (loanId: string) => {
      if (!walletAddress) {
        throw new Error("Wallet not connected");
      }

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

  const loans = loansQuery.data ?? [];

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

  if (status !== "connected") {
    return (
      <AppShell>
        <PageHeader
          eyebrow="Your loans"
          title="Loan dashboard"
          accent="Connect to see positions and pool liquidity."
          description="Link a Solana wallet to load your active loans, risk score, and repayment actions."
        />
        <section className="rounded-xl border border-border bg-card p-8 text-center">
          <h2 className="text-xl font-semibold">Connect wallet</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Your dashboard stays on this page — connect when you&apos;re ready.
          </p>
          <div className="mt-5 flex justify-center">
            <WalletButton
              disconnectedLabel="Connect Wallet"
              className="h-11 px-5 text-sm"
            />
          </div>
          <p className="mt-6 text-sm text-muted-foreground">
            New here?{" "}
            <Link href="/borrow" className="font-medium text-foreground underline">
              Borrow
            </Link>{" "}
            ·{" "}
            <Link href="/lend" className="font-medium text-foreground underline">
              Lend
            </Link>
          </p>
        </section>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHeader
        eyebrow="Your loans"
        title="Loan dashboard"
        description="Track active loans, pool liquidity, and your eligibility profile."
      />

      <div className="flex flex-wrap items-end justify-end gap-4">
          <div className="rounded-xl border border-border bg-card px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Risk score
            </p>
            <p className="font-mono text-2xl font-semibold tabular-nums">
              {riskScoreQuery.data
                ? Math.round(riskScoreQuery.data.score)
                : "--"}
            </p>
          </div>
        </div>

        <section className="mt-6 rounded-xl border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">Pool Balance</p>
          <p className="mt-1 font-mono text-3xl font-semibold tabular-nums">
            {poolBalanceQuery.data
              ? (
                  Number(poolBalanceQuery.data) / LAMPORTS_PER_SOL
                ).toLocaleString(undefined, { maximumFractionDigits: 4 })
              : "0"}{" "}
            SOL
          </p>
        </section>

        <section className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Active loans
          </h2>

          {loansQuery.isLoading && (
            <div className="mt-4 space-y-3">
              {Array.from({ length: 3 }).map((_, idx) => (
                <div
                  key={idx}
                  className="h-28 animate-pulse rounded-xl bg-secondary"
                />
              ))}
            </div>
          )}

          {loansQuery.isError && (
            <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm">
              <p className="font-medium text-destructive">
                Unable to fetch loans.
              </p>
              <button
                type="button"
                onClick={() => loansQuery.refetch()}
                className="mt-3 rounded-md bg-secondary px-3 py-2 text-xs font-medium"
              >
                Retry
              </button>
            </div>
          )}

          {!loansQuery.isLoading &&
            !loansQuery.isError &&
            activeLoans.length === 0 && (
              <div className="mt-4 rounded-xl border border-border bg-card p-8 text-center">
                <p className="text-lg font-medium">
                  No active loans. Ready to borrow?
                </p>
                <Link
                  href="/borrow"
                  className="mt-4 inline-flex h-11 items-center rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground"
                >
                  Open Borrow Page
                </Link>
              </div>
            )}

          {activeLoans.length > 0 && (
            <div className="mt-4 space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                {activeLoans.map((loan) => (
                  <LoanCard key={loan.id} loan={loan} />
                ))}
              </div>

              <div className="overflow-x-auto rounded-xl border border-border bg-card">
                <table className="min-w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="px-4 py-3">Amount</th>
                      <th className="px-4 py-3">Collateral</th>
                      <th className="px-4 py-3">Interest</th>
                      <th className="px-4 py-3">Due</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeLoans.map((loan) => {
                      const pdaMap = walletAddress
                        ? getLoanPdaMap(walletAddress)
                        : {};
                      const canRepay =
                        Boolean(pdaMap[loan.id]) && loan.status === "ACTIVE";

                      return (
                        <tr
                          key={loan.id}
                          className="border-b border-border/70 last:border-0"
                        >
                          <td className="px-4 py-3 font-mono tabular-nums">
                            {lamportsStringToSol(loan.loanAmountLamports)} SOL
                          </td>
                          <td className="px-4 py-3 font-mono tabular-nums">
                            {lamportsStringToSol(loan.collateralAmountLamports)}{" "}
                            SOL
                          </td>
                          <td className="px-4 py-3">
                            {(loan.interestBps / 100).toFixed(2)}%
                          </td>
                          <td className="px-4 py-3">
                            {new Date(
                              Number(loan.dueTimestamp) * 1000
                            ).toLocaleString()}
                          </td>
                          <td className="px-4 py-3">
                            <span className="rounded-full bg-secondary px-2 py-1 text-xs font-medium">
                              {loan.status}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <button
                              type="button"
                              disabled={
                                !canRepay ||
                                isSending ||
                                repayMutation.isPending
                              }
                              onClick={() => repayMutation.mutate(loan.id)}
                              className="rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {repayMutation.isPending
                                ? "Submitting..."
                                : "Repay"}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
    </AppShell>
  );
}
