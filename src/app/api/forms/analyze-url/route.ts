import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { callTextAI } from "@/lib/ai/provider-chain";
import { handleApiError } from "@/lib/api-error";
import { prisma } from "@/lib/prisma";
import { canUploadForm, incrementFormUsage } from "@/lib/subscription";
import { log } from "@/lib/logger";
import { z } from "zod";

export const maxDuration = 60;

// Rate limiter: 10 URL analyses per user per hour (separate from the per-minute AI limit)
const URL_WINDOW_MS = 60 * 60_000; // 1 hour
const URL_LIMIT = 10;
const urlStore = new Map<string, { timestamps: number[] }>();

function checkUrlRateLimit(userId: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const cutoff = now - URL_WINDOW_MS;
  let entry = urlStore.get(userId);
  if (!entry) {
    entry = { timestamps: [] };
    urlStore.set(userId, entry);
  }
  entry.timestamps = entry.timestamps.filter((t) => t > cutoff);
  if (entry.timestamps.length >= URL_LIMIT) {
    const retryAfter = Math.ceil((entry.timestamps[0] + URL_WINDOW_MS - now) / 1000);
    return { allowed: false, retryAfter: retryAfter > 0 ? retryAfter : 1 };
  }
  entry.timestamps.push(now);
  return { allowed: true };
}

// SSRF protection: reject private/loopback IP ranges and localhost
const BLOCKED_HOSTNAME_RE =
  /^(localhost|127\.\d+\.\d+\.\d+|::1|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|192\.168\.\d+\.\d+|0\.0\.0\.0)$/i;

function isSafeUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    if (u.protocol !== "http:" && u.protocol !== "https:") return false;
    if (BLOCKED_HOSTNAME_RE.test(u.hostname)) return false;
    // Block numeric IPs that look private (simple heuristic)
    if (/^\d+\.\d+\.\d+\.\d+$/.test(u.hostname)) {
      // Only allow public IPs — for simplicity, block all numeric IPs to avoid SSRF
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

const bodySchema = z.object({
  url: z.string().url().max(2048),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  const { url } = parsed.data;

  if (!isSafeUrl(url)) {
    return NextResponse.json({ error: "URL not allowed" }, { status: 400 });
  }

  // Check monthly quota
  const quota = await canUploadForm(session.user.id);
  if (!quota.allowed) {
    return NextResponse.json(
      { error: "UPGRADE_REQUIRED", code: "UPGRADE_REQUIRED", formsUsed: quota.formsUsed, limit: quota.limit },
      { status: 402 }
    );
  }

  // Per-user URL rate limit
  const rl = checkUrlRateLimit(session.user.id);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "rate_limited", retryAfter: rl.retryAfter },
      { status: 429 }
    );
  }

  const start = Date.now();

  // Fetch the page HTML server-side
  let html: string;
  try {
    const fetchRes = await fetch(url, {
      headers: {
        "User-Agent": "FormPilot/1.0 (form-field-analysis; https://getformpilot.com)",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
      },
      signal: AbortSignal.timeout(10_000),
      redirect: "follow",
    });
    if (!fetchRes.ok) {
      return NextResponse.json(
        { error: `Could not fetch the page (HTTP ${fetchRes.status}). Check the URL and try again.` },
        { status: 422 }
      );
    }
    const ct = fetchRes.headers.get("content-type") ?? "";
    if (!ct.includes("html")) {
      return NextResponse.json(
        { error: "The URL does not point to an HTML page." },
        { status: 422 }
      );
    }
    // Cap at 512 KB to avoid runaway prompts
    const buf = await fetchRes.arrayBuffer();
    html = new TextDecoder("utf-8", { fatal: false }).decode(buf.slice(0, 512 * 1024));
  } catch (err) {
    if (err instanceof Error && err.name === "TimeoutError") {
      return NextResponse.json({ error: "The page took too long to respond." }, { status: 422 });
    }
    log.warn("URL fetch failed", { url, error: String(err) });
    return NextResponse.json({ error: "Could not reach that URL." }, { status: 422 });
  }

  // Strip scripts, styles, and most tags — keep form-related tags and their attributes
  const stripped = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    // Keep only <form>, <input>, <select>, <textarea>, <label>, <fieldset>, <legend>, <option>
    .replace(/<(?!\/?(?:form|input|select|textarea|label|fieldset|legend|option|button|p|div|span|h[1-6])[\s>\/])[^>]+>/gi, " ")
    .replace(/\s{3,}/g, " ")
    .slice(0, 16_000); // Keep token count manageable

  // Ask Claude to extract form fields from the stripped HTML
  const extractPrompt = `You are a form field extraction expert. Given the HTML below, extract all form input fields and return a JSON array.

For each visible/interactable form field, include:
- "id": a unique snake_case identifier (derive from name/id attribute, or generate from label)
- "label": the human-readable field label (from <label>, aria-label, placeholder, or nearby text)
- "type": one of "text", "email", "phone", "date", "number", "checkbox", "select", "textarea"
- "required": boolean (true if required attribute present or label has *)
- "placeholder": string placeholder text if present, else null
- "index": sequential integer starting at 0

Return ONLY a valid JSON array. No markdown, no explanation. If no form fields are found, return [].

HTML:
${stripped}`;

  let rawFields: Array<{ id: string; label: string; type: string; required: boolean; placeholder: string | null; index: number }>;
  try {
    const resp = await callTextAI(extractPrompt, "analyze-url-extract", 2048);
    if (!resp) throw new Error("Empty extraction response");

    let cleaned = resp;
    const fence = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fence) cleaned = fence[1];
    const arr = cleaned.match(/\[[\s\S]*\]/);
    if (!arr) throw new Error("No JSON array in extraction response");
    rawFields = JSON.parse(arr[0]);
  } catch (err) {
    log.warn("URL field extraction failed", { url, error: String(err) });
    return NextResponse.json(
      { error: "Could not extract form fields from that page. Try a different URL." },
      { status: 422 }
    );
  }

  if (!Array.isArray(rawFields) || rawFields.length === 0) {
    return NextResponse.json(
      { error: "No form fields were found on that page." },
      { status: 422 }
    );
  }

  // Analyse fields with the same AI pipeline used by the web extension
  const fieldDescriptions = rawFields
    .map(
      (f) =>
        `- Field "${f.label}" (type: ${f.type}, id: ${f.id}${f.required ? ", required" : ""}${f.placeholder ? `, placeholder: "${f.placeholder}"` : ""})`
    )
    .join("\n");

  const analyzePrompt = `You are a form analysis expert. Analyze these web form fields and provide explanations.

For each field, provide:
1. A plain-language explanation of what information belongs there
2. A realistic example answer
3. Common mistakes people make

Return ONLY a valid JSON array matching this schema:
[
  {
    "id": "field_id",
    "label": "Field label",
    "type": "field type",
    "index": 0,
    "explanation": "Plain language explanation",
    "example": "Example answer",
    "commonMistakes": "What people often get wrong",
    "profileKey": "firstName or null",
    "value": null,
    "confidence": 0
  }
]

Profile keys available: firstName, lastName, email, phone, dateOfBirth, address.street, address.city, address.state, address.zip, address.country, ssn, passportNumber, employerName, jobTitle, annualIncome

WEB FORM FIELDS:
${fieldDescriptions}`;

  let analyzedFields: Array<Record<string, unknown>>;
  try {
    const resp = await callTextAI(analyzePrompt, "analyze-url-analyze", 4096);
    if (!resp) throw new Error("Empty analysis response");

    let cleaned = resp;
    const fence = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fence) cleaned = fence[1];
    const arr = cleaned.match(/\[[\s\S]*\]/);
    if (!arr) throw new Error("No JSON array in analysis response");
    analyzedFields = JSON.parse(arr[0]);
  } catch (err) {
    return handleApiError(err, "POST /api/forms/analyze-url");
  }

  // Autofill from user profile
  try {
    const profile = await prisma.profile.findUnique({ where: { userId: session.user.id } });
    if (profile) {
      const flat = flattenProfile(profile.data as Record<string, unknown>);
      for (const field of analyzedFields) {
        if (field.profileKey && flat[field.profileKey as string]) {
          field.value = flat[field.profileKey as string];
          field.confidence = 0.9;
        }
      }
    }
  } catch {
    // Non-fatal — proceed without autofill
  }

  // Derive a title from the URL
  const urlObj = new URL(url);
  const title = `${urlObj.hostname}${urlObj.pathname !== "/" ? urlObj.pathname : ""} form`;

  // Create the Form record
  const form = await prisma.form.create({
    data: {
      userId: session.user.id,
      title,
      sourceType: "WEB",
      sourceUrl: url,
      fields: analyzedFields as object,
      status: "ANALYZED",
    },
  });

  // Increment monthly usage
  incrementFormUsage(session.user.id).catch(() => {});

  log.info("URL form analyzed", {
    route: "POST /api/forms/analyze-url",
    durationMs: Date.now() - start,
    fieldCount: analyzedFields.length,
    url,
  });

  return NextResponse.json({ formId: form.id });
}

function flattenProfile(data: Record<string, unknown>, prefix = ""): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(data)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      Object.assign(result, flattenProfile(value as Record<string, unknown>, fullKey));
    } else if (value != null) {
      result[fullKey] = String(value);
    }
  }
  return result;
}
