import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { handleApiError } from "@/lib/api-error";
import { callTextAI } from "@/lib/ai/provider-chain";
import type { FormField } from "@/lib/ai/analyze-form";

// ── Rate limit: 10 reviews per user per hour ──────────────────────────────────
const WINDOW_MS = 60 * 60_000;
const LIMIT = 10;
const userStore = new Map<string, { timestamps: number[] }>();

function checkLimit(userId: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const cutoff = now - WINDOW_MS;
  const entry = userStore.get(userId) ?? { timestamps: [] };
  entry.timestamps = entry.timestamps.filter((t) => t > cutoff);
  if (entry.timestamps.length >= LIMIT) {
    const oldest = entry.timestamps[0];
    return { allowed: false, retryAfter: Math.ceil((oldest + WINDOW_MS - now) / 1000) };
  }
  entry.timestamps.push(now);
  userStore.set(userId, entry);
  return { allowed: true };
}

// ── Types ─────────────────────────────────────────────────────────────────────
export type ReviewCheckStatus = "pass" | "warn" | "fail";

export interface ReviewCheck {
  id: string;
  label: string;
  status: ReviewCheckStatus;
  detail: string | null;
}

export type ReviewStatus = "ready" | "review" | "issues";

export interface ReviewResult {
  status: ReviewStatus;
  score: number; // 0-100 completeness %
  checks: ReviewCheck[];
  submissionNotes: string[];
  cachedAt: number; // unix ms, for client-side 5-min TTL
}

// ── AI prompt ─────────────────────────────────────────────────────────────────
async function runAiReview(
  formTitle: string,
  category: string,
  fields: { label: string; value: string | null; required: boolean; type: string }[]
): Promise<{ checks: ReviewCheck[]; submissionNotes: string[] }> {
  const filledFields = fields.filter((f) => f.value?.trim());

  const fieldSummary = fields
    .map((f) => {
      const status = f.value?.trim() ? `"${f.value}"` : "(blank)";
      const req = f.required ? " [required]" : "";
      return `- ${f.label}${req}: ${status}`;
    })
    .join("\n");

  const prompt = `You are reviewing a completed form before submission. Analyse the filled-in values and return a JSON review.

Form: "${formTitle}" (category: ${category || "general"})

Fields and current values:
${fieldSummary}

Perform ONLY these four checks (do not invent others):

1. required_fields — Are all required fields filled?
2. format_consistency — Are dates/names/phone numbers in a consistent, valid format? Are names spelled the same across fields?
3. cross_field_logic — Are there logical contradictions? (e.g. start date after end date, employed but no employer, etc.)
4. suspicious_values — Are any values implausible? (e.g. birth year that would make someone 150 years old, SSN-like pattern in wrong field, clearly wrong format)

Also provide:
- submissionNotes: 2-3 brief, actionable bullets about what to do with this form (e.g. "Submit to HR, not the IRS", "Keep a copy for your records", form-type-specific advice). If you can't identify the form type, give generic advice.

Return ONLY valid JSON in this exact shape:
{
  "checks": [
    { "id": "required_fields",     "label": "Required fields",      "status": "pass"|"warn"|"fail", "detail": "brief explanation or null" },
    { "id": "format_consistency",  "label": "Format consistency",   "status": "pass"|"warn"|"fail", "detail": "brief explanation or null" },
    { "id": "cross_field_logic",   "label": "Cross-field logic",    "status": "pass"|"warn"|"fail", "detail": "brief explanation or null" },
    { "id": "suspicious_values",   "label": "Suspicious values",    "status": "pass"|"warn"|"fail", "detail": "brief explanation or null" }
  ],
  "submissionNotes": ["...", "...", "..."]
}

Rules:
- detail must be null if status is "pass"
- Be concise: detail ≤ 120 characters
- submissionNotes ≤ 100 characters each
- If the form has fewer than 3 filled fields, return "warn" for required_fields and skip deeper checks
- Return ONLY JSON, no markdown, no prose`;

  try {
    const text = await callTextAI(prompt, "form-review", 600);
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}") + 1;
    if (start === -1 || end === 0) throw new Error("No JSON in response");
    return JSON.parse(text.slice(start, end));
  } catch {
    // Fallback: deterministic checks only
    return {
      checks: [
        { id: "required_fields",    label: "Required fields",    status: "warn", detail: "Could not complete AI review" },
        { id: "format_consistency", label: "Format consistency", status: "warn", detail: "Could not complete AI review" },
        { id: "cross_field_logic",  label: "Cross-field logic",  status: "warn", detail: "Could not complete AI review" },
        { id: "suspicious_values",  label: "Suspicious values",  status: "warn", detail: "Could not complete AI review" },
      ],
      submissionNotes: ["Review your form carefully before submitting.", "Keep a copy of the completed form for your records."],
    };
  }
}

// ── Route handler ─────────────────────────────────────────────────────────────
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = checkLimit(session.user.id);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Try again later.", retryAfter: rl.retryAfter },
      { status: 429 }
    );
  }

  const { id: formId } = await params;

  try {
    const form = await prisma.form.findUnique({
      where: { id: formId },
      select: { userId: true, title: true, category: true, fields: true },
    });

    if (!form || form.userId !== session.user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const fields = (form.fields as unknown as FormField[]) ?? [];
    const totalFields = fields.length;
    const filledCount = fields.filter((f) => f.value?.trim()).length;
    const score = totalFields > 0 ? Math.round((filledCount / totalFields) * 100) : 0;

    // Run AI review
    const fieldInputs = fields.map((f) => ({
      label: f.label,
      value: f.value ?? null,
      required: f.required ?? false,
      type: f.type,
    }));

    const { checks, submissionNotes } = await runAiReview(
      form.title,
      form.category ?? "general",
      fieldInputs
    );

    // Derive overall status from check results
    const hasFail = checks.some((c) => c.status === "fail");
    const hasWarn = checks.some((c) => c.status === "warn");
    const status: ReviewStatus = hasFail ? "issues" : hasWarn ? "review" : "ready";

    const result: ReviewResult = {
      status,
      score,
      checks,
      submissionNotes,
      cachedAt: Date.now(),
    };

    return NextResponse.json(result);
  } catch (err) {
    return handleApiError(err, "POST /api/forms/[id]/review");
  }
}
