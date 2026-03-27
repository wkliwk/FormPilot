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
const CURRENCY_RE = /^\$?\d{1,3}(,\d{3})*(\.\d{1,2})?$|^\d+(\.\d{1,2})?$/;
const EIN_RE = /^\d{2}-?\d{7}$/;
const ITIN_RE = /^9\d{2}-?\d{2}-?\d{4}$/;

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

  // EIN (Employer Identification Number)
  if (label.includes("ein") || label.includes("employer identification")) {
    if (!EIN_RE.test(value)) return "Invalid EIN format. Expected: 12-3456789";
  }

  // ITIN (Individual Taxpayer Identification Number)
  if (label.includes("itin") || label.includes("taxpayer identification")) {
    if (!ITIN_RE.test(value)) return "Invalid ITIN format. Expected: 9XX-XX-XXXX (starts with 9)";
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

  // Currency / monetary amount
  if (
    key === "annualincome" ||
    label.includes("income") ||
    label.includes("salary") ||
    label.includes("amount") ||
    label.includes("rent") ||
    label.includes("payment") ||
    label.includes("price") ||
    label.includes("cost") ||
    label.includes("fee")
  ) {
    if (!CURRENCY_RE.test(value.replace(/\s/g, ""))) {
      return "Invalid amount format. Expected: 1234.56 or $1,234.56";
    }
  }

  // Field length constraints
  const lengthError = validateFieldLength(field, value);
  if (lengthError) return lengthError;

  return null;
}

/** Enforce min/max length constraints based on field type and label. */
function validateFieldLength(field: FormField, value: string): string | null {
  // Names should be at least 1 char and at most 100
  const label = field.label.toLowerCase();
  if (label.includes("name") && value.length > 100) {
    return `"${field.label}" exceeds maximum length of 100 characters`;
  }

  // General text fields — cap at 500 chars (prevents accidental pastes)
  if (field.type === "text" && value.length > 500) {
    return `"${field.label}" exceeds maximum length of 500 characters`;
  }

  // Number fields should not exceed reasonable length
  if (field.type === "number" && value.length > 20) {
    return `"${field.label}" exceeds maximum length of 20 characters`;
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

  // Date range validation: check start/end date pairs
  const dateFields = fields.filter(
    (f) => f.type === "date" || f.label.toLowerCase().includes("date")
  );
  for (const startField of dateFields) {
    const startLabel = startField.label.toLowerCase();
    if (!startLabel.includes("start") && !startLabel.includes("begin") && !startLabel.includes("from")) continue;
    const startValue = values[startField.id]?.trim();
    if (!startValue) continue;

    // Find matching end date field
    const endField = dateFields.find((f) => {
      const endLabel = f.label.toLowerCase();
      return f.id !== startField.id &&
        (endLabel.includes("end") || endLabel.includes("expir") || endLabel.includes("to ") || endLabel.includes("through"));
    });
    if (!endField) continue;
    const endValue = values[endField.id]?.trim();
    if (!endValue) continue;

    const startDate = parseFlexibleDate(startValue);
    const endDate = parseFlexibleDate(endValue);
    if (startDate && endDate && startDate > endDate) {
      errors.push({
        fieldId: endField.id,
        fieldLabel: endField.label,
        severity: "error",
        message: `"${endField.label}" must be after "${startField.label}"`,
        rule: "invalid_format",
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

/** Parse a date string in common formats. Returns null if unparseable. */
function parseFlexibleDate(value: string): Date | null {
  // ISO: YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date(value);
  // US: MM/DD/YYYY or M/D/YYYY
  const usMatch = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (usMatch) {
    const year = usMatch[3].length === 2 ? 2000 + parseInt(usMatch[3]) : parseInt(usMatch[3]);
    return new Date(year, parseInt(usMatch[1]) - 1, parseInt(usMatch[2]));
  }
  return null;
}
