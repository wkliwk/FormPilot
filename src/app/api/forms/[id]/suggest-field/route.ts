import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { handleApiError } from "@/lib/api-error";
import { normalizeLabel } from "@/lib/ai/suggestion-engine";
import { callTextAI } from "@/lib/ai/provider-chain";
import { z } from "zod";

// Rate limit: 60 requests per hour per user
const WINDOW_MS = 60 * 60_000;
const LIMIT = 60;
const userStore = new Map<string, { timestamps: number[] }>();

function checkLimit(userId: string): boolean {
  const now = Date.now();
  const cutoff = now - WINDOW_MS;
  const entry = userStore.get(userId) ?? { timestamps: [] };
  entry.timestamps = entry.timestamps.filter((t) => t > cutoff);
  if (entry.timestamps.length >= LIMIT) return false;
  entry.timestamps.push(now);
  userStore.set(userId, entry);
  return true;
}

// Sensitive fields — never suggest values for these
const SENSITIVE_LABELS = new Set([
  "ssn", "socialsecuritynumber", "passportnumber", "driverlicense",
  "bankaccount", "routingnumber", "creditcard", "taxid", "ein", "itin",
]);

const bodySchema = z.object({
  fieldLabel: z.string().min(1).max(200),
  fieldType: z.string().min(1).max(50),
  partialValue: z.string().max(500),
  formCategory: z.string().max(100).optional(),
  profileKey: z.string().max(100).optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!checkLimit(session.user.id)) {
    return NextResponse.json({ suggestion: null, rateLimited: true }, { status: 429 });
  }

  const { id: formId } = await params;

  try {
    const form = await prisma.form.findUnique({
      where: { id: formId },
      select: { userId: true, category: true },
    });

    if (!form || form.userId !== session.user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = await req.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    const { fieldLabel, fieldType, partialValue, formCategory, profileKey } = parsed.data;
    const normalizedLabel = normalizeLabel(fieldLabel);

    // Never suggest sensitive fields
    if (SENSITIVE_LABELS.has(normalizedLabel)) {
      return NextResponse.json({ suggestion: null });
    }

    // Only suggest for text and number fields
    if (fieldType !== "text" && fieldType !== "number" && fieldType !== "email") {
      return NextResponse.json({ suggestion: null });
    }

    // --- Phase 1: FormMemory (fastest, highest confidence) ---
    const memoryRecord = await prisma.formMemory.findFirst({
      where: {
        userId: session.user.id,
        label: normalizedLabel,
        confidence: { gte: 0.7 },
      },
      orderBy: { lastUsed: "desc" },
    });

    if (memoryRecord?.value) {
      const val = memoryRecord.value;
      // Return suggestion only if it starts with (or equals) the partial value
      if (!partialValue || val.toLowerCase().startsWith(partialValue.toLowerCase())) {
        return NextResponse.json({ suggestion: val, source: "memory" });
      }
    }

    // --- Phase 2: Profile vault (by profileKey or label match) ---
    const profile = await prisma.profile.findUnique({
      where: { userId: session.user.id },
      select: { data: true },
    });

    if (profile?.data && typeof profile.data === "object") {
      const profileData = profile.data as Record<string, unknown>;
      // Try profileKey first, then normalized label
      const lookupKeys = [profileKey, normalizedLabel, fieldLabel.toLowerCase()].filter(Boolean);
      for (const key of lookupKeys) {
        const val = profileData[key!];
        if (typeof val === "string" && val.length > 0) {
          if (!partialValue || val.toLowerCase().startsWith(partialValue.toLowerCase())) {
            return NextResponse.json({ suggestion: val, source: "profile" });
          }
        }
      }
    }

    // --- Phase 3: Claude fallback (only if no profile/memory match) ---
    // Skip if partialValue is long enough to not need AI (>= 5 chars = user knows what they're doing)
    if (partialValue.length >= 5) {
      return NextResponse.json({ suggestion: null });
    }

    const category = formCategory ?? form.category ?? "general";
    const prompt = `You are an AI co-pilot helping a user fill out a ${category} form.
The user is typing into a field labeled "${fieldLabel}" (type: ${fieldType}).
They have typed so far: "${partialValue}"

Suggest the most likely complete value for this field. Be concise — respond with ONLY the complete value, nothing else.
If you cannot confidently suggest a value, respond with exactly: NONE

Examples:
- Field "First Name", typed "Jo" → John
- Field "City", typed "New" → New York
- Field "Country", typed "" → United States
- Field "Occupation", typed "So" → Software Engineer`;

    const response = await callTextAI(prompt, "suggest-field-copilot", 50);
    const suggestion = response.trim();

    if (!suggestion || suggestion === "NONE" || suggestion.length > 200) {
      return NextResponse.json({ suggestion: null });
    }

    // Validate that the suggestion starts with the partial value (if any)
    if (partialValue && !suggestion.toLowerCase().startsWith(partialValue.toLowerCase())) {
      return NextResponse.json({ suggestion: null });
    }

    return NextResponse.json({ suggestion, source: "ai" });
  } catch (err) {
    return handleApiError(err, "POST /api/forms/[id]/suggest-field");
  }
}
