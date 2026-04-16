import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { callTextAI } from "@/lib/ai/provider-chain";
import { handleApiError } from "@/lib/api-error";

// ── Rate limit: 5 imports/hour per user (shared with import-id) ───────────────
const WINDOW_MS = 60 * 60_000;
const LIMIT = 5;
const userStore = new Map<string, { timestamps: number[] }>();

function checkLimit(userId: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const cutoff = now - WINDOW_MS;
  const entry = userStore.get(userId) ?? { timestamps: [] };
  entry.timestamps = entry.timestamps.filter((t) => t > cutoff);
  if (entry.timestamps.length >= LIMIT) {
    return { allowed: false, retryAfter: Math.ceil((entry.timestamps[0] + WINDOW_MS - now) / 1000) };
  }
  entry.timestamps.push(now);
  userStore.set(userId, entry);
  return { allowed: true };
}

// Fields we extract from LinkedIn (name, title, employer, location — public only)
const LINKEDIN_EXTRACT_PROMPT = `You are extracting profile information from a LinkedIn public profile HTML snippet.

Extract ONLY these fields (omit any you cannot determine with confidence):
- firstName (string)
- lastName (string)
- jobTitle (string — current role title)
- employerName (string — current employer / company)
- address (object with city and country only — from location line)

Return ONLY valid JSON. No markdown, no prose. Example:
{"firstName":"Jane","lastName":"Smith","jobTitle":"Software Engineer","employerName":"Acme Corp","address":{"city":"San Francisco","country":"US"}}

Profile HTML:
`;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = checkLimit(session.user.id);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Import limit reached. You can import up to 5 times per hour.", retryAfter: rl.retryAfter },
      { status: 429 }
    );
  }

  let url: string;
  try {
    const body = await req.json() as { url?: unknown };
    url = typeof body.url === "string" ? body.url.trim() : "";
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  // Validate URL format
  if (!url || !url.includes("linkedin.com/in/")) {
    return NextResponse.json(
      { error: "Please enter a valid LinkedIn profile URL (e.g. linkedin.com/in/yourname)" },
      { status: 400 }
    );
  }

  // Normalise URL
  const profileUrl = url.startsWith("http") ? url : `https://${url}`;

  try {
    // Fetch public LinkedIn profile HTML
    const res = await fetch(profileUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; FormPilot/1.0; +https://getformpilot.com)",
        Accept: "text/html",
      },
      signal: AbortSignal.timeout(8000),
    });

    if (res.status === 999 || res.status === 429 || res.status === 403) {
      // LinkedIn is blocking the fetch — tell user to use CV paste instead
      return NextResponse.json(
        { error: "Profile not accessible — LinkedIn may have privacy settings enabled. Try 'Paste CV / bio' instead." },
        { status: 422 }
      );
    }

    if (!res.ok) {
      return NextResponse.json(
        { error: "Could not load that LinkedIn profile. Check the URL and try again." },
        { status: 422 }
      );
    }

    const html = await res.text();

    // Strip most HTML tags, keep only text content, cap at 8000 chars
    const text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s{2,}/g, " ")
      .trim()
      .slice(0, 8000);

    if (text.length < 100) {
      return NextResponse.json(
        { error: "Profile not accessible — LinkedIn may have privacy settings enabled. Try 'Paste CV / bio' instead." },
        { status: 422 }
      );
    }

    const raw = await callTextAI(LINKEDIN_EXTRACT_PROMPT + text, "linkedin-import", 300);
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}") + 1;
    if (start === -1 || end === 0) {
      return NextResponse.json(
        { error: "Could not extract profile data from that LinkedIn page. Try 'Paste CV / bio' instead." },
        { status: 422 }
      );
    }

    const fields = JSON.parse(raw.slice(start, end)) as Record<string, unknown>;

    if (Object.keys(fields).length === 0) {
      return NextResponse.json(
        { error: "No profile data found. The profile may be private. Try 'Paste CV / bio' instead." },
        { status: 422 }
      );
    }

    return NextResponse.json({ fields });
  } catch (err) {
    // Timeout or network error
    if (err instanceof Error && (err.name === "AbortError" || err.message.includes("timeout"))) {
      return NextResponse.json(
        { error: "LinkedIn took too long to respond. Try 'Paste CV / bio' instead." },
        { status: 422 }
      );
    }
    return handleApiError(err, "POST /api/profile/import-linkedin");
  }
}
