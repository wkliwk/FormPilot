import type { FormField } from "@/lib/ai/analyze-form";

export interface ValidationIssue {
  fieldId: string;
  fieldLabel: string;
  severity: "error" | "warning";
  message: string;
  rule: "missing_required" | "invalid_format" | "suspicious_value" | "low_confidence" | "empty_optional";
}

export interface ValidationResult {
  valid: boolean;
  completeness: number; // 0-100
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}

// Format validators by profile key or field type
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[\d\s().+\-]{7,20}$/;
const SSN4_RE = /^\d{4}$/;
const SSN_FULL_RE = /^\d{3}-?\d{2}-?\d{4}$/;
const ZIP_RE = /^\d{5}(-\d{4})?$/;
const DATE_RE = /^(\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{2,4}|\d{1,2}-\d{1,2}-\d{2,4})$/;

function validateFieldFormat(field: FormField, value: string): string | null {
  const key = field.profileKey?.toLowerCase() ?? "";
  const label = field.label.toLowerCase();

  // Email
  if (key === "email" || label.includes("email")) {
    if (!EMAIL_RE.test(value)) return "Invalid email format. Expected: name@example.com";
  }

  // Phone
  if (key === "phone" || label.includes("phone") || label.includes("telephone")) {
    if (!PHONE_RE.test(value)) return "Invalid phone format. Expected: (555) 123-4567 or similar";
  }

  // SSN
  if (key === "ssn" || label.includes("social security") || label.includes("ssn")) {
    if (!SSN4_RE.test(value) && !SSN_FULL_RE.test(value)) {
      return "Invalid SSN format. Expected: last 4 digits (1234) or full (123-45-6789)";
    }
  }

  // ZIP
  if (
    key === "address.zip" ||
    label.includes("zip") ||
    label.includes("postal code")
  ) {
    if (!ZIP_RE.test(value)) return "Invalid ZIP code. Expected: 12345 or 12345-6789";
  }

  // Date
  if (field.type === "date" || key === "dateofbirth" || label.includes("date")) {
    if (!DATE_RE.test(value)) return "Invalid date format. Expected: MM/DD/YYYY or YYYY-MM-DD";
  }

  return null;
}

export function validateForm(
  fields: FormField[],
  values: Record<string, string>,
  fieldStates: Record<string, string>
): ValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  let filledCount = 0;

  for (const field of fields) {
    const value = values[field.id]?.trim() ?? "";
    const state = fieldStates[field.id];
    const hasValue = value.length > 0;

    if (hasValue) filledCount++;

    // Required field check
    if (field.required && !hasValue) {
      errors.push({
        fieldId: field.id,
        fieldLabel: field.label,
        severity: "error",
        message: `"${field.label}" is required but empty`,
        rule: "missing_required",
      });
      continue;
    }

    // Format validation (only if value exists)
    if (hasValue) {
      const formatError = validateFieldFormat(field, value);
      if (formatError) {
        errors.push({
          fieldId: field.id,
          fieldLabel: field.label,
          severity: "error",
          message: formatError,
          rule: "invalid_format",
        });
      }
    }

    // Low confidence warning: autofilled + accepted without edit + confidence < 0.5
    if (
      hasValue &&
      field.confidence !== undefined &&
      field.confidence < 0.5 &&
      field.confidence > 0 &&
      (state === "accepted" || state === "pending")
    ) {
      warnings.push({
        fieldId: field.id,
        fieldLabel: field.label,
        severity: "warning",
        message: `"${field.label}" was auto-filled with low confidence (${Math.round(field.confidence * 100)}%). Please verify manually.`,
        rule: "low_confidence",
      });
    }

    // Empty optional field warning (non-blocking)
    if (!field.required && !hasValue && state !== "rejected") {
      warnings.push({
        fieldId: field.id,
        fieldLabel: field.label,
        severity: "warning",
        message: `"${field.label}" is optional and empty`,
        rule: "empty_optional",
      });
    }
  }

  const completeness = fields.length > 0 ? Math.round((filledCount / fields.length) * 100) : 100;

  return {
    valid: errors.length === 0,
    completeness,
    errors,
    warnings,
  };
}
