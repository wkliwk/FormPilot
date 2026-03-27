/**
 * HTTP status codes that indicate a transient error worth retrying.
 * 429 — rate limited
 * 500 — internal server error
 * 502 — bad gateway
 * 503 — service unavailable
 * 529 — Claude overloaded (Anthropic-specific)
 */
const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 529]);

/**
 * HTTP status codes that indicate a permanent client error — never retry.
 * 400 — bad request
 * 401 — authentication failure
 * 404 — not found
 */
const NON_RETRYABLE_STATUSES = new Set([400, 401, 404]);

/** Backoff delays in milliseconds for attempts 1, 2, 3 (after the initial try). */
const BACKOFF_DELAYS_MS = [1000, 2000, 4000];

export const MAX_RETRIES = 3;

/** Error thrown when all retry attempts are exhausted. */
export class ClaudeUnavailableError extends Error {
  constructor(public readonly lastError: Error, attempts: number) {
    super(`AI service unavailable after ${attempts} attempt(s): ${lastError.message}`);
    this.name = "ClaudeUnavailableError";
  }
}

/** Check if an error has an HTTP status (Anthropic APIError duck typing). */
function getErrorStatus(err: unknown): number | undefined {
  const status = (err as { status?: unknown }).status;
  return typeof status === "number" ? status : undefined;
}

function isRetryable(err: unknown): boolean {
  const status = getErrorStatus(err);
  if (status !== undefined) {
    if (NON_RETRYABLE_STATUSES.has(status)) return false;
    return RETRYABLE_STATUSES.has(status);
  }
  // Network-level errors (no status) are retryable — e.g. connection reset.
  return err instanceof Error && err.name !== "ClaudeUnavailableError";
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Calls `fn` and retries up to MAX_RETRIES times with exponential backoff on
 * transient Claude API errors (429, 500, 502, 503, 529).
 *
 * - Non-retryable errors (400, 401, 404) are rethrown immediately.
 * - Logs each retry attempt to console.
 * - On first retry, logs a user-facing message.
 * - After all attempts exhausted, throws ClaudeUnavailableError.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  context: string = "Claude API call"
): Promise<T> {
  let lastError: Error = new Error("Unknown error");

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (!(err instanceof Error)) {
        throw err;
      }

      lastError = err;

      // Non-retryable — rethrow immediately.
      const errStatus = getErrorStatus(err);
      if (errStatus !== undefined && NON_RETRYABLE_STATUSES.has(errStatus)) {
        throw err;
      }

      const isLast = attempt === MAX_RETRIES;

      if (!isRetryable(err) || isLast) {
        throw isLast ? new ClaudeUnavailableError(lastError, attempt + 1) : err;
      }

      const backoffMs = BACKOFF_DELAYS_MS[attempt] ?? BACKOFF_DELAYS_MS[BACKOFF_DELAYS_MS.length - 1];
      const status = errStatus !== undefined ? ` (HTTP ${errStatus})` : "";

      if (attempt === 0) {
        console.warn(`[retry] AI service temporarily unavailable, retrying... [${context}]${status}`);
      }

      console.warn(
        `[retry] Attempt ${attempt + 1}/${MAX_RETRIES} failed for "${context}"${status} — retrying in ${backoffMs}ms`
      );

      await delay(backoffMs);
    }
  }

  // This line is unreachable but satisfies TypeScript.
  throw new ClaudeUnavailableError(lastError, MAX_RETRIES + 1);
}
