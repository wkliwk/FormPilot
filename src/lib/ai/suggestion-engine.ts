import { prisma } from "@/lib/prisma";
import type { FormField } from "@/lib/ai/analyze-form";

// Sensitive profile keys — never suggest these from history or memory
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
  source: string; // Form title or "Form Memory"
  sourceType: "memory" | "history";
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
 * Query FormMemory (structured per-user memory store) first at confidence >= 0.8.
 * Fall back to scanning recent form history for unmatched fields.
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

  const suggestions: FieldSuggestion[] = [];
  const coveredLabels = new Set<string>();

  // --- Step 1: Query FormMemory (structured, high-confidence) ---
  const memoryRecords = await prisma.formMemory.findMany({
    where: {
      userId,
      label: { in: Array.from(labelToFieldId.keys()) },
      confidence: { gte: 0.8 },
    },
    orderBy: { lastUsed: "desc" },
  });

  for (const record of memoryRecords) {
    const fieldId = labelToFieldId.get(record.label);
    if (!fieldId) continue;

    suggestions.push({
      fieldId,
      value: record.value,
      confidence: record.confidence,
      source: record.sourceTitle,
      sourceType: "memory",
    });
    coveredLabels.add(record.label);
  }

  // --- Step 2: Fall back to history scan for unmatched fields ---
  const remainingLabels = new Set(
    Array.from(labelToFieldId.keys()).filter((l) => !coveredLabels.has(l))
  );

  if (remainingLabels.size === 0) {
    return suggestions;
  }

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

  const bestMatch = new Map<string, { value: string; formTitle: string }>();

  for (const form of pastForms) {
    const pastFields = form.fields as unknown as FormField[];
    if (!Array.isArray(pastFields)) continue;

    for (const pastField of pastFields) {
      if (!pastField.label || !pastField.value) continue;

      const normalized = normalizeLabel(pastField.label);
      if (!remainingLabels.has(normalized)) continue;
      if (isSensitiveLabel(normalized)) continue;

      if (!bestMatch.has(normalized)) {
        bestMatch.set(normalized, {
          value: pastField.value,
          formTitle: form.title,
        });
      }
    }
  }

  for (const [normalizedLabel, match] of bestMatch) {
    const fieldId = labelToFieldId.get(normalizedLabel);
    if (!fieldId) continue;

    suggestions.push({
      fieldId,
      value: match.value,
      confidence: 0.6,
      source: match.formTitle,
      sourceType: "history",
    });
  }

  return suggestions;
}
