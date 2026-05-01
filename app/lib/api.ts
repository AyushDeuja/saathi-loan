import axios from "axios";

export type LoanTerms = {
  ltv: number;
  interestRateBps: number;
  maxDurationDays: number;
  approved: boolean;
};

export type RiskScoreBreakdown = {
  walletAge: number;
  solBalance: number;
  txVolume: number;
  repaymentHistory: number;
  defiActivity: number;
};

export type RiskScoreResult = {
  score: number;
  breakdown: RiskScoreBreakdown;
  terms: LoanTerms;
};

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

export type LoanRequestBody = {
  walletAddress: string;
  loanAmountLamports: number;
  durationDays: number;
};

export type LoanRequestResponse = {
  loanId: string;
  collateralRequired: number;
  interestLamports: number;
  dueTimestamp: number;
  terms: LoanTerms;
};

type ApiErrorPayload = {
  error?: string;
  details?: unknown;
};

export class ApiClientError extends Error {
  status?: number;
  isRateLimited: boolean;
  isTimeout: boolean;
  isNetworkError: boolean;

  constructor(
    message: string,
    options?: {
      status?: number;
      isRateLimited?: boolean;
      isTimeout?: boolean;
      isNetworkError?: boolean;
    }
  ) {
    super(message);
    this.name = "ApiClientError";
    this.status = options?.status;
    this.isRateLimited = Boolean(options?.isRateLimited);
    this.isTimeout = Boolean(options?.isTimeout);
    this.isNetworkError = Boolean(options?.isNetworkError);
  }
}

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000",
  timeout: 20_000,
});

function formatApiError(error: unknown): ApiClientError {
  if (axios.isAxiosError<ApiErrorPayload>(error)) {
    const status = error.response?.status;
    const isRateLimited = status === 429;
    const isTimeout = error.code === "ECONNABORTED";
    const isNetworkError = !error.response;
    const serverMessage = error.response?.data?.error;

    const message =
      serverMessage ??
      (isRateLimited
        ? "Server is rate-limited (429). Please retry in a few seconds."
        : isTimeout
          ? "Request timed out. Please retry."
          : isNetworkError
            ? "Could not reach backend API. Check if backend is running."
            : error.message ?? "Request failed");

    return new ApiClientError(message, {
      status,
      isRateLimited,
      isTimeout,
      isNetworkError,
    });
  }

  if (error instanceof Error) {
    return new ApiClientError(error.message);
  }

  return new ApiClientError("Unknown API error");
}

export async function getRiskScore(
  walletAddress: string
): Promise<RiskScoreResult> {
  try {
    const response = await api.get<RiskScoreResult>(
      `/score/${encodeURIComponent(walletAddress)}`
    );
    return response.data;
  } catch (error) {
    throw formatApiError(error);
  }
}

export async function requestLoan(
  body: LoanRequestBody
): Promise<LoanRequestResponse> {
  try {
    const response = await api.post<LoanRequestResponse>("/loan/request", body);
    return response.data;
  } catch (error) {
    throw formatApiError(error);
  }
}

export async function getLoans(walletAddress: string): Promise<LoanRecord[]> {
  try {
    const response = await api.get<{
      walletAddress: string;
      loans: LoanRecord[];
    }>(`/loan/${encodeURIComponent(walletAddress)}`);
    return response.data.loans;
  } catch (error) {
    throw formatApiError(error);
  }
}
