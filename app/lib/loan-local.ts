export type LoanPdaRecord = {
  loanId: string;
  loanPda: string;
  collateralPda: string;
  loanIndex: string;
};

function storageKey(walletAddress: string): string {
  return `sollend:loan-pdas:${walletAddress}`;
}

export function getLoanPdaMap(
  walletAddress: string
): Record<string, LoanPdaRecord> {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const raw = localStorage.getItem(storageKey(walletAddress));
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw) as Record<string, LoanPdaRecord>;
    return parsed;
  } catch {
    return {};
  }
}

export function saveLoanPdaRecord(
  walletAddress: string,
  record: LoanPdaRecord
): void {
  if (typeof window === "undefined") {
    return;
  }

  const existing = getLoanPdaMap(walletAddress);
  existing[record.loanId] = record;
  localStorage.setItem(storageKey(walletAddress), JSON.stringify(existing));
}
