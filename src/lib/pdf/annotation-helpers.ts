import type { FormField } from "@/lib/ai/analyze-form";

/**
 * Normalize text for fuzzy matching: lowercase, collapse whitespace, strip punctuation.
 */
export function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
}

/**
 * Match a PDF annotation (by fieldName or altText) to one of our FormFields.
 * Returns the matching field id or null.
 */
export function matchAnnotationToField(
  annot: { fieldName?: string; alternativeText?: string },
  fields: FormField[]
): string | null {
  const candidates = [annot.fieldName, annot.alternativeText].filter(Boolean) as string[];
  for (const candidate of candidates) {
    const norm = normalize(candidate);
    // Exact match first
    const exact = fields.find((f) => normalize(f.label) === norm);
    if (exact) return exact.id;
    // Substring match
    const sub = fields.find(
      (f) => normalize(f.label).includes(norm) || norm.includes(normalize(f.label))
    );
    if (sub) return sub.id;
  }
  return null;
}
