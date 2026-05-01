-- CreateTable
CREATE TABLE "Loan" (
    "id" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "loanAmount" BIGINT NOT NULL,
    "collateralAmount" BIGINT NOT NULL,
    "interestBps" INTEGER NOT NULL,
    "durationDays" INTEGER NOT NULL,
    "dueTimestamp" BIGINT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "riskScore" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Loan_pkey" PRIMARY KEY ("id")
);
