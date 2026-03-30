/**
 * Unit tests for src/lib/api-error.ts
 *
 * Verifies that handleApiError maps Claude SDK error codes to the
 * structured JSON shapes required by issue #178:
 *   - 429 → 503 with { error: "rate_limited", retryAfter: N }
 *   - 503/529 → 503 with { error: "ai_unavailable" }
 *   - Other → 500 with { error: "analysis_failed", message: "..." }
 */

import { handleApiError } from "@/lib/api-error";
import { ClaudeUnavailableError } from "@/lib/ai/retry";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Duck-typed Anthropic SDK error (minimal shape). */
function makeApiError(
  status: number,
  headers: Record<string, string> = {}
): Error & { status: number; headers: Record<string, string> } {
  const err = new Error(`HTTP ${status}`) as Error & {
    status: number;
    headers: Record<string, string>;
  };
  err.status = status;
  err.headers = headers;
  return err;
}

function parseBody(res: ReturnType<typeof handleApiError>) {
  // NextResponse.json stores body in _body or as an async json() — mock env
  // exposes it via the Response API.
  return (res as unknown as { body: unknown }).body;
}

// ---------------------------------------------------------------------------
// Rate-limited (429) → 503 rate_limited
// ---------------------------------------------------------------------------

describe("handleApiError — 429 rate_limited", () => {
  it("returns HTTP 503 with error: rate_limited", async () => {
    const err = makeApiError(429);
    const res = handleApiError(err, "test-route");
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toBe("rate_limited");
  });

  it("uses retry-after header when present", async () => {
    const err = makeApiError(429, { "retry-after": "30" });
    const res = handleApiError(err, "test-route");
    const body = await res.json();
    expect(body.retryAfter).toBe(30);
  });

  it("defaults retryAfter to 60 when no header", async () => {
    const err = makeApiError(429);
    const res = handleApiError(err, "test-route");
    const body = await res.json();
    expect(body.retryAfter).toBe(60);
  });

  it("defaults retryAfter to 60 when header is non-numeric", async () => {
    const err = makeApiError(429, { "retry-after": "soon" });
    const res = handleApiError(err, "test-route");
    const body = await res.json();
    expect(body.retryAfter).toBe(60);
  });
});

// ---------------------------------------------------------------------------
// Unavailable (503 / 529) → 503 ai_unavailable
// ---------------------------------------------------------------------------

describe("handleApiError — 503/529 ai_unavailable", () => {
  it.each([503, 529])("returns HTTP 503 with error: ai_unavailable for status %i", async (status) => {
    const err = makeApiError(status);
    const res = handleApiError(err, "test-route");
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toBe("ai_unavailable");
  });

  it("returns ai_unavailable for 502 (bad gateway)", async () => {
    const err = makeApiError(502);
    const res = handleApiError(err, "test-route");
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toBe("ai_unavailable");
  });
});

// ---------------------------------------------------------------------------
// ClaudeUnavailableError (retry exhaustion) → 503 ai_unavailable
// ---------------------------------------------------------------------------

describe("handleApiError — ClaudeUnavailableError", () => {
  it("returns HTTP 503 with error: ai_unavailable when retries exhausted", async () => {
    const last = new Error("timeout");
    const err = new ClaudeUnavailableError(last, 4);
    const res = handleApiError(err, "test-route");
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toBe("ai_unavailable");
  });
});

// ---------------------------------------------------------------------------
// Other AI errors → 500 analysis_failed
// ---------------------------------------------------------------------------

describe("handleApiError — analysis_failed fallback", () => {
  it("returns HTTP 500 with error: analysis_failed for unknown errors", async () => {
    const err = new Error("Something went wrong");
    const res = handleApiError(err, "test-route");
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("analysis_failed");
    expect(typeof body.message).toBe("string");
    expect(body.message.length).toBeGreaterThan(0);
  });

  it("returns HTTP 500 with analysis_failed for 4xx non-429 Claude errors", async () => {
    const err = makeApiError(422);
    const res = handleApiError(err, "test-route");
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("analysis_failed");
  });

  it("does not expose raw error messages to client", async () => {
    const err = new Error("Internal SDK secret: apikey=sk-abc123");
    const res = handleApiError(err, "test-route");
    const body = await res.json();
    expect(JSON.stringify(body)).not.toContain("sk-abc123");
  });

  it("includes a non-empty sanitised message for analysis_failed", async () => {
    const err = new Error("No JSON found in AI response");
    const res = handleApiError(err, "test-route");
    const body = await res.json();
    expect(body.error).toBe("analysis_failed");
    expect(body.message).toBeTruthy();
  });
});
