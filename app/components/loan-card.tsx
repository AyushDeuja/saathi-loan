"use client";

import { useMemo } from "react";
import type { LoanRecord } from "../lib/api";

type LoanCardProps = {
  loan: LoanRecord;
};

const LAMPORTS_PER_SOL = 1_000_000_000;

function lamportsStringToSol(value: string): string {
  const numeric = Number(value) / LAMPORTS_PER_SOL;
  return numeric.toLocaleString(undefined, {
    minimumFractionDigits: numeric < 1 ? 4 : 2,
    maximumFractionDigits: 4,
  });
}

function formatCountdown(dueTimestamp: number): string {
  const delta = dueTimestamp - Math.floor(Date.now() / 1000);

  if (delta <= 0) {
    return "Overdue";
  }

  const days = Math.floor(delta / 86400);
  const hours = Math.floor((delta % 86400) / 3600);

  if (days > 0) {
    return `${days}d ${hours}h`;
  }

  const minutes = Math.floor((delta % 3600) / 60);
  return `${hours}h ${minutes}m`;
}

export function LoanCard({ loan }: LoanCardProps) {
  const dueTimestamp = Number(loan.dueTimestamp);
  const overdue = loan.status === "ACTIVE" && dueTimestamp < Date.now() / 1000;

  const countdown = useMemo(
    () => formatCountdown(dueTimestamp),
    [dueTimestamp]
  );

  return (
    <article className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Loan
          </p>
          <p className="mt-1 font-mono text-lg font-semibold tabular-nums">
            {lamportsStringToSol(loan.loanAmountLamports)} SOL
          </p>
        </div>
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
            overdue
              ? "bg-destructive/15 text-destructive"
              : "bg-secondary text-secondary-foreground"
          }`}
        >
          {overdue ? "Overdue" : loan.status}
        </span>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-4 text-sm">
        <div>
          <dt className="text-muted-foreground">Collateral</dt>
          <dd className="font-mono tabular-nums">
            {lamportsStringToSol(loan.collateralAmountLamports)} SOL
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Due In</dt>
          <dd className={overdue ? "text-destructive" : ""}>{countdown}</dd>
        </div>
      </dl>
    </article>
  );
}
