/**
 * Structured API error handling utilities.
 *
 * Provides consistent error responses and classifies errors from
 * external services (Claude API, Prisma).
 */

import { NextResponse } from "next/server";
import { log } from "./logger";
import { ClaudeUnavailableError } from "./ai/retry";

export interface ApiErrorResponse {
  error: string;
  retryAfter?: number;
  message?: string;
}

/** Default retry-after seconds when the API does not provide a header. */
const DEFAULT_RETRY_AFTER_SECONDS = 60;

/** Read retry-after header value in seconds from a duck-typed error object. */
function getRetryAfter(err: unknown): number {
  const headers = (err as { headers?: Record<string, string> }).headers;
  if (!headers) return DEFAULT_RETRY_AFTER_SECONDS;
  const raw = headers["retry-after"] ?? headers["Retry-After"];
  if (!raw) return DEFAULT_RETRY_AFTER_SECONDS;
  const parsed = parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_RETRY_AFTER_SECONDS;
}

/**
 * Classify an error and return an appropriate HTTP response.
 * Logs the error with structured metadata.
 */
export function handleApiError(err: unknown, route: string): NextResponse<ApiErrorResponse> {
  const error = err instanceof Error ? err : new Error(String(err));

  // Anthropic SDK errors include a `status` property
  const status = (err as { status?: number }).status;
  const errorType = (err as { error?: { type?: string } }).error?.type;

  // Claude API errors
  if (status === 429) {
    const retryAfter = getRetryAfter(err);
    log.warn("Claude API rate limited", { route, error: error.message, retryAfter });
    return NextResponse.json(
      { error: "rate_limited", retryAfter },
      { status: 503 }
    );
  }
  if (status === 401) {
    log.error("Claude API authentication failed", { route, error: error.message });
    return NextResponse.json(
      { error: "analysis_failed", message: "AI service configuration error. Please contact support." },
      { status: 500 }
    );
  }
  if (status === 529 || status === 503 || status === 502) {
    log.warn("Claude API unavailable", { route, status, error: error.message });
    return NextResponse.json(
      { error: "ai_unavailable" },
      { status: 503 }
    );
  }
  if (status && status >= 400 && status < 500) {
    log.error("Claude API client error", { route, status, errorType, error: error.message });
    return NextResponse.json(
      { error: "analysis_failed", message: "AI processing error. Please try again with different input." },
      { status: 500 }
    );
  }
  if (status && status >= 500) {
    log.error("Claude API server error", { route, status, error: error.message });
    return NextResponse.json(
      { error: "ai_unavailable" },
      { status: 503 }
    );
  }

  // Claude retry exhaustion
  if (error instanceof ClaudeUnavailableError) {
    log.error("Claude API unavailable after retries", { route, error: error.message });
    return NextResponse.json(
      { error: "ai_unavailable" },
      { status: 503 }
    );
  }

  // Prisma errors
  if (error.name === "PrismaClientKnownRequestError" || error.name === "PrismaClientValidationError") {
    const prismaCode = (err as { code?: string }).code;
    log.error("Database error", { route, prismaCode, error: error.message });

    if (prismaCode === "P2002") {
      return NextResponse.json(
        { error: "analysis_failed", message: "A record with this data already exists." },
        { status: 409 }
      );
    }
    if (prismaCode === "P2025") {
      return NextResponse.json(
        { error: "analysis_failed", message: "Record not found." },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { error: "analysis_failed", message: "Database error. Please try again." },
      { status: 500 }
    );
  }

  // Application-level errors (our own throws)
  if (error.message.includes("No JSON found")) {
    log.warn("AI returned non-JSON response", { route });
    return NextResponse.json(
      { error: "analysis_failed", message: "AI could not analyze the form. Please try again or use a clearer document." },
      { status: 500 }
    );
  }
  if (error.message.includes("Failed to parse AI response")) {
    log.warn("AI returned malformed JSON", { route, error: error.message });
    return NextResponse.json(
      { error: "analysis_failed", message: "AI response was malformed. Please try again." },
      { status: 500 }
    );
  }

  // Generic fallback
  log.error("Unhandled error", { route, error: error.message, stack: error.stack });
  return NextResponse.json(
    { error: "analysis_failed", message: "An unexpected error occurred. Please try again." },
    { status: 500 }
  );
}
