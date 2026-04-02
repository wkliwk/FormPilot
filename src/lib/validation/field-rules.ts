/**
 * Per-field format validation rules.
 * Extracted from validate-form.ts so they can be reused for real-time
 * blur-based validation in the UI without running the full form check.
 */
import type { FormField } from "@/lib/ai/analyze-form";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[\d\s().+\-]{7,20}$/;
const SSN4_RE = /^\d{4}$/;
const SSN_FULL_RE = /^\d{3}-?\d{2}-?\d{4}$/;
const ZIP_RE = /^\d{5}(-\d{4})?$/;
const DATE_RE = /^(\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{2,4}|\d{1,2}-\d{1,2}-\d{2,4})$/;
const CURRENCY_RE = /^\$?\d{1,3}(,\d{3})*(\.\d{1,2})?$|^\d+(\.\d{1,2})?$/;
const EIN_RE = /^\d{2}-?\d{7}$/;
const ITIN_RE = /^9\d{2}-?\d{2}-?\d{4}$/;

/**
 * Validate the format of a single field value.
 * Returns an error message string if invalid, or null if valid.
 * Empty values are always valid here — required-field checks are done separately.
 */
export function validateFieldFormat(field: FormField, value: string): string | null {
  if (!value.trim()) return null; // empty = valid for format purposes

  const key = field.profileKey?.toLowerCase() ?? "";
  const label = field.label.toLowerCase();

  if (key === "email" || label.includes("email")) {
    if (!EMAIL_RE.test(value)) return "Invalid email format. Expected: name@example.com";
  }

  if (key === "phone" || label.includes("phone") || label.includes("telephone")) {
    if (!PHONE_RE.test(value)) return "Invalid phone format. Expected: (555) 123-4567 or similar";
  }

  if (key === "ssn" || label.includes("social security") || label.includes("ssn")) {
    if (!SSN4_RE.test(value) && !SSN_FULL_RE.test(value)) {
      return "Invalid SSN format. Expected: last 4 digits (1234) or full (123-45-6789)";
    }
  }

  if (label.includes("ein") || label.includes("employer identification")) {
    if (!EIN_RE.test(value)) return "Invalid EIN format. Expected: 12-3456789";
  }

  if (label.includes("itin") || label.includes("taxpayer identification")) {
    if (!ITIN_RE.test(value)) return "Invalid ITIN format. Expected: 9XX-XX-XXXX (starts with 9)";
  }

  const isCombinedAddressField =
    (label.includes("city") || label.includes("town") || label.includes("state")) &&
    label.includes("zip");
  if (
    !isCombinedAddressField &&
    (key === "address.zip" || label.includes("zip") || label.includes("postal code"))
  ) {
    if (!ZIP_RE.test(value)) return "Invalid ZIP code. Expected: 12345 or 12345-6789";
  }

  if (field.type === "date" || key === "dateofbirth" || label.includes("date")) {
    if (!DATE_RE.test(value)) return "Invalid date format. Expected: MM/DD/YYYY or YYYY-MM-DD";
  }

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

  return null;
}
