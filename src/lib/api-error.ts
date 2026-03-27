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
  code: string;
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
    log.warn("Claude API rate limited", { route, error: error.message });
    return NextResponse.json(
      { error: "AI service is temporarily busy. Please try again in a moment.", code: "AI_RATE_LIMITED" },
      { status: 503 }
    );
  }
  if (status === 401) {
    log.error("Claude API authentication failed", { route, error: error.message });
    return NextResponse.json(
      { error: "AI service configuration error. Please contact support.", code: "AI_AUTH_ERROR" },
      { status: 500 }
    );
  }
  if (status === 529 || status === 503 || status === 502) {
    log.warn("Claude API unavailable", { route, status, error: error.message });
    return NextResponse.json(
      { error: "AI service is temporarily unavailable. Please try again shortly.", code: "AI_UNAVAILABLE" },
      { status: 503 }
    );
  }
  if (status && status >= 400 && status < 500) {
    log.error("Claude API client error", { route, status, errorType, error: error.message });
    return NextResponse.json(
      { error: "AI processing error. Please try again with different input.", code: "AI_CLIENT_ERROR" },
      { status: 422 }
    );
  }
  if (status && status >= 500) {
    log.error("Claude API server error", { route, status, error: error.message });
    return NextResponse.json(
      { error: "AI service error. Please try again shortly.", code: "AI_SERVER_ERROR" },
      { status: 503 }
    );
  }

  // Claude retry exhaustion
  if (error instanceof ClaudeUnavailableError) {
    log.error("Claude API unavailable after retries", { route, error: error.message });
    return NextResponse.json(
      { error: "AI service is temporarily unavailable. Please try again shortly.", code: "AI_UNAVAILABLE" },
      { status: 503 }
    );
  }

  // Prisma errors
  if (error.name === "PrismaClientKnownRequestError" || error.name === "PrismaClientValidationError") {
    const prismaCode = (err as { code?: string }).code;
    log.error("Database error", { route, prismaCode, error: error.message });

    if (prismaCode === "P2002") {
      return NextResponse.json(
        { error: "A record with this data already exists.", code: "DB_DUPLICATE" },
        { status: 409 }
      );
    }
    if (prismaCode === "P2025") {
      return NextResponse.json(
        { error: "Record not found.", code: "DB_NOT_FOUND" },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { error: "Database error. Please try again.", code: "DB_ERROR" },
      { status: 500 }
    );
  }

  // Application-level errors (our own throws)
  if (error.message.includes("No JSON found")) {
    log.warn("AI returned non-JSON response", { route });
    return NextResponse.json(
      { error: "AI could not analyze the form. Please try again or use a clearer document.", code: "AI_PARSE_ERROR" },
      { status: 422 }
    );
  }
  if (error.message.includes("Failed to parse AI response")) {
    log.warn("AI returned malformed JSON", { route, error: error.message });
    return NextResponse.json(
      { error: "AI response was malformed. Please try again.", code: "AI_PARSE_ERROR" },
      { status: 422 }
    );
  }

  // Generic fallback
  log.error("Unhandled error", { route, error: error.message, stack: error.stack });
  return NextResponse.json(
    { error: "An unexpected error occurred. Please try again.", code: "INTERNAL_ERROR" },
    { status: 500 }
  );
}
