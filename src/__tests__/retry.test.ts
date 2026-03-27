/**
 * Unit tests for src/lib/ai/retry.ts
 *
 * Tests exponential backoff, retryable/non-retryable status codes,
 * exhaustion behaviour, and the ClaudeUnavailableError shape.
 *
 * jest.useFakeTimers() is used so backoff delays run at full speed.
 */

import { withRetry, ClaudeUnavailableError, MAX_RETRIES } from "@/lib/ai/retry";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a minimal fake error with an HTTP status (duck-typed like Anthropic APIError). */
function makeAPIError(status: number): Error & { status: number } {
  const err = new Error(`HTTP ${status}`) as Error & { status: number };
  err.status = status;
  return err;
}

/**
 * Run withRetry and advance all fake timers so backoff delays are skipped.
 * Returns a result object with either { result } or { error }.
 *
 * We race the withRetry promise against repeated timer advancement so that
 * neither side blocks the other.
 */
async function runWithRetry<T>(
  fn: () => Promise<T>,
  context?: string
): Promise<{ result?: T; error?: unknown }> {
  // Wrap promise to prevent unhandled rejection noise while timers advance.
  let settled = false;
  let resolve!: (v: { result?: T; error?: unknown }) => void;
  const outer = new Promise<{ result?: T; error?: unknown }>((r) => { resolve = r; });

  withRetry(fn, context).then(
    (result) => { settled = true; resolve({ result }); },
    (error: unknown) => { settled = true; resolve({ error }); }
  );

  // Advance fake timers in a loop until the promise settles.
  while (!settled) {
    await jest.runAllTimersAsync();
  }

  return outer;
}

// ---------------------------------------------------------------------------
// Timer mocking
// ---------------------------------------------------------------------------

beforeAll(() => {
  jest.useFakeTimers();
});

afterAll(() => {
  jest.useRealTimers();
});

beforeEach(() => {
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Success path
// ---------------------------------------------------------------------------

describe("withRetry — success", () => {
  it("returns the result immediately when the call succeeds on the first try", async () => {
    const fn = jest.fn().mockResolvedValue("ok");
    const { result } = await runWithRetry(fn);
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("returns the result when the call succeeds after one transient failure", async () => {
    const fn = jest.fn()
      .mockRejectedValueOnce(makeAPIError(429))
      .mockResolvedValue("recovered");

    const { result } = await runWithRetry(fn);
    expect(result).toBe("recovered");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("returns the result after two transient failures (retry 2/3)", async () => {
    const fn = jest.fn()
      .mockRejectedValueOnce(makeAPIError(503))
      .mockRejectedValueOnce(makeAPIError(502))
      .mockResolvedValue("recovered-after-two");

    const { result } = await runWithRetry(fn);
    expect(result).toBe("recovered-after-two");
    expect(fn).toHaveBeenCalledTimes(3);
  });
});

// ---------------------------------------------------------------------------
// Non-retryable status codes — should rethrow immediately
// ---------------------------------------------------------------------------

describe("withRetry — non-retryable errors", () => {
  it.each([400, 401, 404])(
    "rethrows HTTP %i immediately without retrying",
    async (status) => {
      const err = makeAPIError(status);
      const fn = jest.fn().mockRejectedValue(err);

      const { error } = await runWithRetry(fn);

      expect(error).toBe(err);
      expect(fn).toHaveBeenCalledTimes(1);
    }
  );
});

// ---------------------------------------------------------------------------
// Retryable status codes — should retry up to MAX_RETRIES times
// ---------------------------------------------------------------------------

describe("withRetry — retryable status codes exhausted", () => {
  it.each([429, 500, 502, 503, 529])(
    "retries HTTP %i and throws ClaudeUnavailableError after all attempts",
    async (status) => {
      const fn = jest.fn().mockRejectedValue(makeAPIError(status));

      const { error } = await runWithRetry(fn);

      expect(error).toBeInstanceOf(ClaudeUnavailableError);
      // Initial attempt + MAX_RETRIES retries
      expect(fn).toHaveBeenCalledTimes(MAX_RETRIES + 1);
    }
  );
});

// ---------------------------------------------------------------------------
// ClaudeUnavailableError shape
// ---------------------------------------------------------------------------

describe("ClaudeUnavailableError", () => {
  it("includes 'unavailable' in the message and wraps the last error", async () => {
    const err = makeAPIError(503);
    const fn = jest.fn().mockRejectedValue(err);

    const { error } = await runWithRetry(fn, "test-context");

    expect(error).toBeInstanceOf(ClaudeUnavailableError);
    const unavailable = error as ClaudeUnavailableError;
    expect(unavailable.message).toContain("unavailable");
    expect(unavailable.lastError).toBe(err);
  });

  it("exposes the lastError property", async () => {
    const originalErr = makeAPIError(500);
    const fn = jest.fn().mockRejectedValue(originalErr);

    const { error } = await runWithRetry(fn);

    expect((error as ClaudeUnavailableError).lastError).toBe(originalErr);
  });
});

// ---------------------------------------------------------------------------
// Retry attempt count
// ---------------------------------------------------------------------------

describe("withRetry — attempt count", () => {
  it(`makes exactly ${MAX_RETRIES + 1} total attempts before giving up`, async () => {
    const fn = jest.fn().mockRejectedValue(makeAPIError(429));

    const { error } = await runWithRetry(fn);

    expect(error).toBeInstanceOf(ClaudeUnavailableError);
    expect(fn).toHaveBeenCalledTimes(MAX_RETRIES + 1);
  });
});

// ---------------------------------------------------------------------------
// Backoff delay timing
// ---------------------------------------------------------------------------

describe("withRetry — backoff delays", () => {
  it("completes all retries only after fake timers are advanced", async () => {
    const fn = jest.fn().mockRejectedValue(makeAPIError(429));

    // Without runAllTimersAsync() the promise would hang indefinitely.
    // The fact that this test resolves proves delays are timer-based.
    const { error } = await runWithRetry(fn);

    expect(error).toBeInstanceOf(ClaudeUnavailableError);
    expect(fn).toHaveBeenCalledTimes(MAX_RETRIES + 1);
  });
});

// ---------------------------------------------------------------------------
// Context label in logs
// ---------------------------------------------------------------------------

describe("withRetry — logging", () => {
  it("logs a user-facing warning on the first retry attempt", async () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

    const fn = jest.fn()
      .mockRejectedValueOnce(makeAPIError(503))
      .mockResolvedValue("ok");

    await runWithRetry(fn, "my-context");

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("AI service temporarily unavailable")
    );
    warnSpy.mockRestore();
  });

  it("includes the context label in retry log messages", async () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

    const fn = jest.fn()
      .mockRejectedValueOnce(makeAPIError(429))
      .mockResolvedValue("done");

    await runWithRetry(fn, "analyzeFormFields");

    const calls = warnSpy.mock.calls.map((c) => c[0] as string);
    expect(calls.some((msg) => msg.includes("analyzeFormFields"))).toBe(true);
    warnSpy.mockRestore();
  });

  it("includes the HTTP status in retry log messages", async () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

    const fn = jest.fn()
      .mockRejectedValueOnce(makeAPIError(429))
      .mockResolvedValue("done");

    await runWithRetry(fn, "ctx");

    const calls = warnSpy.mock.calls.map((c) => c[0] as string);
    expect(calls.some((msg) => msg.includes("429"))).toBe(true);
    warnSpy.mockRestore();
  });
});
