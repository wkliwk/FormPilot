import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { handleApiError } from "@/lib/api-error";
import { validateFieldFormat, suggestFieldFix } from "@/lib/validation/field-rules";
import { callTextAI } from "@/lib/ai/provider-chain";
import type { FormField } from "@/lib/ai/analyze-form";

// Rate limit: 30 requests per hour per user (stored in-memory, acceptable for serverless)
const WINDOW_MS = 60 * 60_000; // 1 hour
const LIMIT = 30;
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

interface FieldInput {
  id: string;
  label: string;
  type: string;
  value: string;
  formCategory?: string;
  profileKey?: string;
  required?: boolean;
}

interface ValidationError {
  fieldId: string;
  fieldLabel: string;
  issue: string;
  suggestion: string | null;
  fixedValue: string | null; // deterministic correction if possible
}

// Ask Claude to validate a batch of fields with ambiguous formats
async function claudeValidateBatch(
  fields: FieldInput[],
  formCategory: string
): Promise<Record<string, { issue: string; suggestion: string } | null>> {
  const prompt = `You are validating form field values for a ${formCategory || "general"} form.
For each field below, determine if the value looks plausible and correctly formatted for that field type.
Only flag clear problems — do not flag values that are merely unusual.

Fields to validate:
${fields.map((f) => `- Label: "${f.label}" | Type: ${f.type} | Value: "${f.value}"`).join("\n")}

Respond with a JSON object where keys are field labels and values are either:
- null (value is fine)
- { "issue": "brief description of the problem", "suggestion": "what the user should enter instead" }

Example: { "Passport Number": { "issue": "US passports are 9 characters, this has 8", "suggestion": "Check your passport — it should be 9 alphanumeric characters" }, "Full Name": null }

Return only valid JSON, no prose.`;

  try {
    const text = await callTextAI(prompt, "validate-values", 500);
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}") + 1;
    if (start === -1 || end === 0) return {};
    const parsed = JSON.parse(text.slice(start, end));
    return parsed;
  } catch {
    return {};
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!checkLimit(session.user.id)) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Try again later." },
      { status: 429 }
    );
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
    const fields: FieldInput[] = body.fields ?? [];

    if (!Array.isArray(fields) || fields.length === 0) {
      return NextResponse.json({ errors: [] });
    }

    const errors: ValidationError[] = [];
    const ambiguousFields: FieldInput[] = [];

    // Phase 1: deterministic regex validation
    for (const f of fields) {
      if (!f.value?.trim()) continue;

      // Create a minimal FormField shape for the existing validators
      const mockField: FormField = {
        id: f.id,
        label: f.label,
        type: f.type as FormField["type"],
        profileKey: f.profileKey,
        required: f.required ?? false,
        explanation: "",
        example: "",
        commonMistakes: "",
      };

      const formatErr = validateFieldFormat(mockField, f.value);
      if (formatErr) {
        const fix = suggestFieldFix(mockField, f.value);
        errors.push({
          fieldId: f.id,
          fieldLabel: f.label,
          issue: formatErr,
          suggestion: fix ? `Try: ${fix}` : null,
          fixedValue: fix,
        });
      } else {
        // No regex error — pass to Claude for ambiguous format checking
        // Only include text/number fields with non-trivial values
        if (
          (f.type === "text" || f.type === "number") &&
          f.value.length > 0 &&
          f.value.length < 100
        ) {
          ambiguousFields.push(f);
        }
      }
    }

    // Phase 2: Claude validation for fields that passed regex (ambiguous cases)
    // Only run if there are candidates and we have a form category context
    if (ambiguousFields.length > 0 && ambiguousFields.length <= 20) {
      const aiResults = await claudeValidateBatch(
        ambiguousFields,
        form.category ?? "general"
      );

      for (const f of ambiguousFields) {
        const result = aiResults[f.label];
        if (result && result.issue) {
          errors.push({
            fieldId: f.id,
            fieldLabel: f.label,
            issue: result.issue,
            suggestion: result.suggestion ?? null,
            fixedValue: null, // AI suggestions are descriptive, not auto-applicable
          });
        }
      }
    }

    return NextResponse.json({ errors });
  } catch (err) {
    return handleApiError(err, "POST /api/forms/[id]/validate-values");
  }
}
