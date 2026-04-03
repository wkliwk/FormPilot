import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { callTextAI } from "@/lib/ai/provider-chain";
import { handleApiError } from "@/lib/api-error";
import { log } from "@/lib/logger";

export const maxDuration = 30;

const MAX_TEXT_LENGTH = 10_000;
const MIN_TEXT_LENGTH = 50;
const DAILY_LIMIT = 5;

async function checkDailyLimit(userId: string): Promise<{ allowed: boolean; remaining: number }> {
  const key = `${userId}:profile_extract`;
  const now = new Date();
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const record = await prisma.rateLimit.findUnique({ where: { key } });

  if (!record || record.windowStart < dayStart) {
    // New day — upsert with count=1
    await prisma.rateLimit.upsert({
      where: { key },
      create: { key, count: 1, windowStart: dayStart },
      update: { count: 1, windowStart: dayStart },
    });
    return { allowed: true, remaining: DAILY_LIMIT - 1 };
  }

  if (record.count >= DAILY_LIMIT) {
    return { allowed: false, remaining: 0 };
  }

  await prisma.rateLimit.update({
    where: { key },
    data: { count: { increment: 1 } },
  });
  return { allowed: true, remaining: DAILY_LIMIT - record.count - 1 };
}

const EXTRACT_PROMPT = `You are a data extraction assistant. Extract personal profile information from the text below.

Return ONLY a JSON object with the fields you are confident about. Omit any field you are not sure of.
Use exactly these field names:
- firstName (string)
- lastName (string)
- email (string)
- phone (string — include country code if present, e.g. +1-555-123-4567)
- dateOfBirth (string — format as YYYY-MM-DD if possible, otherwise as written)
- address (object with: street, city, state, zip, country — only include sub-fields you are confident about)
- employerName (string)
- jobTitle (string)
- annualIncome (string — include currency symbol if present, e.g. "$85,000")
- ssn (string — only extract if explicitly stated)
- passportNumber (string — only extract if explicitly stated)
- driverLicense (string — only extract if explicitly stated)

Rules:
- Only include fields you are confident about
- Do NOT guess or infer values
- Do NOT include fields with empty values
- Return valid JSON only — no explanation, no markdown fences

Text to extract from:
`;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { text?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (text.length < MIN_TEXT_LENGTH) {
    return NextResponse.json(
      { error: `Text is too short. Please paste at least ${MIN_TEXT_LENGTH} characters.` },
      { status: 400 }
    );
  }
  if (text.length > MAX_TEXT_LENGTH) {
    return NextResponse.json(
      { error: `Text is too long. Maximum ${MAX_TEXT_LENGTH.toLocaleString()} characters.` },
      { status: 400 }
    );
  }

  const limit = await checkDailyLimit(session.user.id);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Daily limit reached. You can extract profile data up to 5 times per day." },
      { status: 429 }
    );
  }

  try {
    const start = Date.now();
    const raw = await callTextAI(EXTRACT_PROMPT + text, "profileExtract", 1024);

    // Parse — strip markdown fences if present
    const cleaned = raw.replace(/^```json\s*/i, "").replace(/\s*```$/i, "").trim();
    let extracted: Record<string, unknown>;
    try {
      extracted = JSON.parse(cleaned) as Record<string, unknown>;
    } catch {
      log.warn("Profile extract: AI returned non-JSON", {
        route: "POST /api/profile/extract",
        userId: session.user.id,
        rawPreview: raw.slice(0, 200),
      });
      return NextResponse.json({ fields: {} });
    }

    // Remove null/empty values
    const clean = Object.fromEntries(
      Object.entries(extracted).filter(([, v]) => {
        if (v === null || v === undefined || v === "") return false;
        if (typeof v === "object" && !Array.isArray(v)) {
          const sub = Object.values(v as Record<string, unknown>).filter((sv) => sv !== null && sv !== undefined && sv !== "");
          return sub.length > 0;
        }
        return true;
      })
    );

    log.info("Profile extracted from text", {
      route: "POST /api/profile/extract",
      durationMs: Date.now() - start,
      userId: session.user.id,
      fieldCount: Object.keys(clean).length,
    });

    return NextResponse.json({ fields: clean, remaining: limit.remaining });
  } catch (err) {
    return handleApiError(err, "POST /api/profile/extract");
  }
}
