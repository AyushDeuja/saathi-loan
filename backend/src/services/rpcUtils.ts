const DEFAULT_MAX_ATTEMPTS = 4;
const DEFAULT_BASE_DELAY_MS = 400;

function isRateLimitError(error: unknown): boolean {
  const message =
    error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return (
    message.includes("429") ||
    message.includes("too many requests") ||
    message.includes("rate limit")
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withRpcRetry<T>(
  operation: () => Promise<T>,
  label: string,
  maxAttempts = DEFAULT_MAX_ATTEMPTS,
  baseDelayMs = DEFAULT_BASE_DELAY_MS
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (!isRateLimitError(error) || attempt === maxAttempts) {
        throw error;
      }

      const exponentialDelay = baseDelayMs * 2 ** (attempt - 1);
      const jitter = Math.floor(Math.random() * 150);
      const delayMs = exponentialDelay + jitter;

      console.warn(
        `[rpc] ${label} rate-limited (attempt ${attempt}/${maxAttempts}), retrying in ${delayMs}ms`
      );
      await sleep(delayMs);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`RPC operation failed: ${label}`);
}
