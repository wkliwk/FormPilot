import { buildCorsHeaders, withCors, handleCorsPreFlight } from "@/lib/cors";
import { NextRequest, NextResponse } from "next/server";

function makeRequest(origin: string | null): NextRequest {
  const headers: Record<string, string> = {};
  if (origin) headers["origin"] = origin;
  return new NextRequest("https://formpilot-brown.vercel.app/api/test", {
    headers,
  });
}

describe("buildCorsHeaders", () => {
  it("returns headers for a chrome-extension origin", () => {
    const headers = buildCorsHeaders("chrome-extension://abcdef123456");
    expect(headers).not.toBeNull();
    expect(headers!["Access-Control-Allow-Origin"]).toBe(
      "chrome-extension://abcdef123456"
    );
    expect(headers!["Access-Control-Allow-Credentials"]).toBe("true");
  });

  it("returns null for an arbitrary third-party origin", () => {
    const headers = buildCorsHeaders("https://evil.example.com");
    expect(headers).toBeNull();
  });

  it("returns null for a null origin", () => {
    const headers = buildCorsHeaders(null);
    expect(headers).toBeNull();
  });

  it("allows localhost:3300 in non-production environment", () => {
    const originalEnv = process.env.NODE_ENV;
    Object.defineProperty(process.env, "NODE_ENV", {
      value: "development",
      writable: true,
    });
    const headers = buildCorsHeaders("http://localhost:3300");
    expect(headers).not.toBeNull();
    Object.defineProperty(process.env, "NODE_ENV", {
      value: originalEnv,
      writable: true,
    });
  });

  it("allows the NEXT_PUBLIC_APP_URL origin", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://formpilot-brown.vercel.app";
    const headers = buildCorsHeaders("https://formpilot-brown.vercel.app");
    expect(headers).not.toBeNull();
    expect(headers!["Access-Control-Allow-Origin"]).toBe(
      "https://formpilot-brown.vercel.app"
    );
    delete process.env.NEXT_PUBLIC_APP_URL;
  });
});

describe("handleCorsPreFlight", () => {
  it("returns 204 for an allowed extension origin", async () => {
    const req = makeRequest("chrome-extension://abc123");
    const res = handleCorsPreFlight(req);
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(
      "chrome-extension://abc123"
    );
  });

  it("returns 403 for a disallowed origin", () => {
    const req = makeRequest("https://attacker.example.com");
    const res = handleCorsPreFlight(req);
    expect(res.status).toBe(403);
  });
});

describe("withCors", () => {
  it("attaches CORS headers to an existing response", () => {
    const req = makeRequest("chrome-extension://xyz789");
    const response = NextResponse.json({ ok: true });
    const result = withCors(response, req);
    expect(result.headers.get("Access-Control-Allow-Origin")).toBe(
      "chrome-extension://xyz789"
    );
    expect(result.headers.get("Access-Control-Allow-Credentials")).toBe("true");
  });

  it("returns response unchanged when origin is not allowed", () => {
    const req = makeRequest("https://unknown.example.com");
    const response = NextResponse.json({ ok: true });
    const result = withCors(response, req);
    expect(result.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });
});
