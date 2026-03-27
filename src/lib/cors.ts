import { NextRequest, NextResponse } from "next/server";

/**
 * Allowed origins for CORS.
 *
 * - In production: the deployed Vercel URL (from NEXT_PUBLIC_APP_URL).
 * - In development: localhost:3000.
 * - Always: any chrome-extension:// origin, so the packed/unpacked
 *   extension can reach the API regardless of its generated ID.
 */
function getAllowedOrigins(): string[] {
  const origins: string[] = [];

  if (process.env.NEXT_PUBLIC_APP_URL) {
    origins.push(process.env.NEXT_PUBLIC_APP_URL);
  }

  if (process.env.NODE_ENV !== "production") {
    origins.push("http://localhost:3000");
  }

  return origins;
}

/**
 * Returns true when the given origin should be granted CORS access.
 * Chrome extension origins look like: chrome-extension://<id>
 */
function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  if (origin.startsWith("chrome-extension://")) return true;
  return getAllowedOrigins().includes(origin);
}

/**
 * Build CORS response headers for an allowed origin.
 * Returns null when the origin is not allowed.
 */
export function buildCorsHeaders(
  origin: string | null
): Record<string, string> | null {
  if (!isAllowedOrigin(origin)) return null;

  return {
    "Access-Control-Allow-Origin": origin as string,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Max-Age": "86400",
  };
}

/**
 * Handle a pre-flight OPTIONS request.
 * Returns a 204 No Content response with CORS headers, or 403 if the
 * origin is not allowed.
 */
export function handleCorsPreFlight(req: NextRequest): NextResponse {
  const origin = req.headers.get("origin");
  const corsHeaders = buildCorsHeaders(origin);

  if (!corsHeaders) {
    return new NextResponse(null, { status: 403 });
  }

  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

/**
 * Attach CORS headers to an existing NextResponse.
 * If the origin is not allowed the response is returned unchanged.
 */
export function withCors(
  response: NextResponse,
  req: NextRequest
): NextResponse {
  const origin = req.headers.get("origin");
  const corsHeaders = buildCorsHeaders(origin);

  if (!corsHeaders) return response;

  Object.entries(corsHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  return response;
}
