import { prisma } from "@/lib/prisma";
import type { FormField } from "@/lib/ai/analyze-form";

// Sensitive profile keys — never suggest these from history
const SENSITIVE_LABELS = new Set([
  "ssn",
  "socialsecuritynumber",
  "passportnumber",
  "driverlicense",
  "driverslicense",
  "bankaccount",
  "routingnumber",
  "creditcard",
  "creditcardnumber",
  "taxid",
  "ein",
  "itin",
]);

export interface FieldSuggestion {
  fieldId: string;
  value: string;
  confidence: number;
  source: string; // Title of the form it came from
}

/** Normalize a label for fuzzy matching: lowercase, strip punctuation/spaces */
export function normalizeLabel(label: string): string {
  return label.toLowerCase().trim().replace(/[^a-z0-9]/g, "");
}

/** Returns true if a normalized label is considered sensitive */
function isSensitiveLabel(normalizedLabel: string): boolean {
  return SENSITIVE_LABELS.has(normalizedLabel);
}

/**
 * Query up to 20 most recent COMPLETED or FILLING forms for a user and return
 * history-based suggestions for the given current form fields.
 *
 * - Field matching uses normalized label comparison (case-insensitive, punctuation-stripped).
 * - Returns the most recent non-empty value per field label.
 * - Sensitive labels are excluded.
 * - Confidence is fixed at 0.6.
 */
export async function getSuggestionsFromHistory(
  userId: string,
  currentFields: FormField[]
): Promise<FieldSuggestion[]> {
  // Build a map of normalized label -> fieldId for the current form
  const labelToFieldId = new Map<string, string>();
  for (const field of currentFields) {
    const normalized = normalizeLabel(field.label);
    if (!isSensitiveLabel(normalized)) {
      labelToFieldId.set(normalized, field.id);
    }
  }

  if (labelToFieldId.size === 0) {
    return [];
  }

  // Query past forms — limit 20, most recent first
  const pastForms = await prisma.form.findMany({
    where: {
      userId,
      status: { in: ["COMPLETED", "FILLING"] },
    },
    select: {
      id: true,
      title: true,
      fields: true,
      updatedAt: true,
    },
    orderBy: { updatedAt: "desc" },
    take: 20,
  });

  if (pastForms.length === 0) {
    return [];
  }

  // For each matching label, track the most recent value and its source form title
  // Map: normalized label -> { value, formTitle }
  const bestMatch = new Map<string, { value: string; formTitle: string }>();

  for (const form of pastForms) {
    const pastFields = form.fields as unknown as FormField[];
    if (!Array.isArray(pastFields)) continue;

    for (const pastField of pastFields) {
      if (!pastField.label || !pastField.value) continue;

      const normalized = normalizeLabel(pastField.label);
      if (!labelToFieldId.has(normalized)) continue;
      if (isSensitiveLabel(normalized)) continue;

      // Only store if we don't have a value yet (forms are ordered by updatedAt desc,
      // so the first match per label is the most recent)
      if (!bestMatch.has(normalized)) {
        bestMatch.set(normalized, {
          value: pastField.value,
          formTitle: form.title,
        });
      }
    }
  }

  const suggestions: FieldSuggestion[] = [];
  for (const [normalizedLabel, match] of bestMatch) {
    const fieldId = labelToFieldId.get(normalizedLabel);
    if (!fieldId) continue;

    suggestions.push({
      fieldId,
      value: match.value,
      confidence: 0.6,
      source: match.formTitle,
    });
  }

  return suggestions;
}
