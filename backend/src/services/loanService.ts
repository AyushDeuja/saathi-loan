import { prisma } from "../db/prisma.js";

export type LoanRecord = {
  id: string;
  walletAddress: string;
  loanAmountLamports: string;
  collateralAmountLamports: string;
  interestBps: number;
  durationDays: number;
  dueTimestamp: string;
  status: string;
  riskScore: number;
  createdAt: string;
  updatedAt: string;
};

export type CreateLoanRecordInput = {
  walletAddress: string;
  loanAmountLamports: number;
  collateralAmountLamports: number;
  interestBps: number;
  durationDays: number;
  dueTimestamp: number;
  riskScore: number;
};

function serializeLoan(loan: {
  id: string;
  walletAddress: string;
  loanAmount: bigint;
  collateralAmount: bigint;
  interestBps: number;
  durationDays: number;
  dueTimestamp: bigint;
  status: string;
  riskScore: number;
  createdAt: Date;
  updatedAt: Date;
}): LoanRecord {
  return {
    id: loan.id,
    walletAddress: loan.walletAddress,
    loanAmountLamports: loan.loanAmount.toString(),
    collateralAmountLamports: loan.collateralAmount.toString(),
    interestBps: loan.interestBps,
    durationDays: loan.durationDays,
    dueTimestamp: loan.dueTimestamp.toString(),
    status: loan.status,
    riskScore: loan.riskScore,
    createdAt: loan.createdAt.toISOString(),
    updatedAt: loan.updatedAt.toISOString(),
  };
}

export async function createLoanRecord(
  input: CreateLoanRecordInput
): Promise<LoanRecord> {
  const created = await prisma.loan.create({
    data: {
      walletAddress: input.walletAddress,
      loanAmount: BigInt(input.loanAmountLamports),
      collateralAmount: BigInt(input.collateralAmountLamports),
      interestBps: input.interestBps,
      durationDays: input.durationDays,
      dueTimestamp: BigInt(input.dueTimestamp),
      status: "ACTIVE",
      riskScore: input.riskScore,
    },
  });

  return serializeLoan(created);
}

export async function getLoansForWallet(
  walletAddress: string
): Promise<LoanRecord[]> {
  const loans = await prisma.loan.findMany({
    where: { walletAddress },
    orderBy: { createdAt: "desc" },
  });

  return loans.map(serializeLoan);
}

export async function getRecentLoans(limit = 10): Promise<LoanRecord[]> {
  const loans = await prisma.loan.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return loans.map(serializeLoan);
}
