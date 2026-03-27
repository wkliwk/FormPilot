/**
 * Mock Claude API responses for deterministic testing.
 * Matches the response format expected by analyze-form.ts.
 */

import type { FormField, FormAnalysis } from "@/lib/ai/analyze-form";

// ---------------------------------------------------------------------------
// analyzeFormFields() responses
// ---------------------------------------------------------------------------

export const TAX_FORM_ANALYSIS: FormAnalysis = {
  title: "Form W-4 Employee's Withholding Certificate",
  description:
    "IRS form used by employees to tell their employer how much federal income tax to withhold from their paycheck.",
  fields: [
    {
      id: "first_name",
      label: "First name and middle initial",
      type: "text",
      required: true,
      explanation: "Your legal first name as it appears on your Social Security card.",
      example: "Jane M.",
      commonMistakes: "Using a nickname instead of legal name.",
      profileKey: "firstName",
    },
    {
      id: "last_name",
      label: "Last name",
      type: "text",
      required: true,
      explanation: "Your legal last name as it appears on your Social Security card.",
      example: "Doe",
      commonMistakes: "Not matching the name on your Social Security card.",
      profileKey: "lastName",
    },
    {
      id: "ssn",
      label: "Social Security Number",
      type: "text",
      required: true,
      explanation: "Your 9-digit Social Security Number in XXX-XX-XXXX format.",
      example: "123-45-6789",
      commonMistakes: "Transposing digits or using an ITIN instead of SSN.",
      profileKey: "ssn",
    },
    {
      id: "address",
      label: "Address",
      type: "text",
      required: true,
      explanation: "Your current home mailing address.",
      example: "123 Main St",
      commonMistakes: "Using a PO Box when a physical address is required.",
      profileKey: "address.street",
    },
    {
      id: "city_state_zip",
      label: "City or town, state, and ZIP code",
      type: "text",
      required: true,
      explanation: "Your city, state abbreviation, and ZIP code.",
      example: "Springfield, IL 62704",
      commonMistakes: "Forgetting the ZIP code or using wrong state abbreviation.",
      profileKey: null,
    },
    {
      id: "multiple_jobs",
      label: "Multiple Jobs or Spouse Works",
      type: "checkbox",
      required: false,
      explanation:
        "Check this if you hold more than one job or if married filing jointly and spouse also works.",
      example: "Checked",
      commonMistakes: "Not checking this when applicable, leading to under-withholding.",
      profileKey: null,
    },
    {
      id: "dependents_total",
      label: "Claim Dependents Total",
      type: "number",
      required: false,
      explanation: "Total dollar amount for dependent credits.",
      example: "4000",
      commonMistakes: "Entering the number of dependents instead of the dollar amount.",
      profileKey: null,
    },
    {
      id: "signature",
      label: "Employee's signature",
      type: "signature",
      required: true,
      explanation: "Your handwritten or electronic signature certifying the information.",
      example: "Jane M. Doe",
      commonMistakes: "Forgetting to sign the form.",
      profileKey: null,
    },
    {
      id: "date",
      label: "Date",
      type: "date",
      required: true,
      explanation: "The date you are completing this form in MM/DD/YYYY format.",
      example: "03/15/2026",
      commonMistakes: "Using the wrong date format.",
      profileKey: null,
    },
  ],
  estimatedMinutes: 10,
  category: "TAX",
};

export const LEASE_FORM_ANALYSIS: FormAnalysis = {
  title: "Residential Lease Agreement",
  description:
    "Standard residential lease agreement between a landlord and tenant for rental property.",
  fields: [
    {
      id: "tenant_name",
      label: "Tenant Name",
      type: "text",
      required: true,
      explanation: "Full legal name of the tenant.",
      example: "Jane Doe",
      commonMistakes: "Using a nickname.",
      profileKey: null,
    },
    {
      id: "tenant_email",
      label: "Tenant Email",
      type: "text",
      required: true,
      explanation: "Tenant email for communications.",
      example: "jane@example.com",
      commonMistakes: "Typos in email address.",
      profileKey: "email",
    },
    {
      id: "tenant_phone",
      label: "Tenant Phone",
      type: "text",
      required: true,
      explanation: "Tenant phone number.",
      example: "(555) 123-4567",
      commonMistakes: "Missing area code.",
      profileKey: "phone",
    },
    {
      id: "property_address",
      label: "Property Address",
      type: "text",
      required: true,
      explanation: "Full address of the rental property.",
      example: "456 Oak Ave",
      commonMistakes: "Inconsistent address across documents.",
      profileKey: null,
    },
    {
      id: "lease_start",
      label: "Lease Start Date",
      type: "date",
      required: true,
      explanation: "The date the lease begins.",
      example: "04/01/2026",
      commonMistakes: "Confusing move-in date with lease start.",
      profileKey: null,
    },
    {
      id: "monthly_rent",
      label: "Monthly Rent",
      type: "number",
      required: true,
      explanation: "Monthly rent amount in dollars.",
      example: "1500",
      commonMistakes: "Not including utilities in the total.",
      profileKey: null,
    },
  ],
  estimatedMinutes: 15,
  category: "LEGAL",
};

// ---------------------------------------------------------------------------
// autofillFields() responses
// ---------------------------------------------------------------------------

export const TAX_FORM_AUTOFILL_RESPONSE = [
  { id: "first_name", value: "Jane", confidence: 1.0 },
  { id: "last_name", value: "Doe", confidence: 1.0 },
  { id: "address", value: "123 Main St", confidence: 1.0 },
  { id: "city_state_zip", value: "Springfield, IL 62704", confidence: 0.8 },
  { id: "date", value: "03/27/2026", confidence: 0.5 },
];

export const LEASE_AUTOFILL_RESPONSE = [
  { id: "tenant_email", value: "jane.doe@example.com", confidence: 1.0 },
  { id: "tenant_phone", value: "(555) 123-4567", confidence: 1.0 },
];

// ---------------------------------------------------------------------------
// Raw Claude message response wrappers
// ---------------------------------------------------------------------------

/** Wrap a JSON object in the Claude message format. */
export function makeClaudeResponse(jsonData: unknown): {
  content: Array<{ type: "text"; text: string }>;
} {
  return {
    content: [
      {
        type: "text" as const,
        text: `Here is the analysis:\n\n\`\`\`json\n${JSON.stringify(jsonData, null, 2)}\n\`\`\``,
      },
    ],
  };
}

/** Make a Claude response that returns no JSON (error scenario). */
export function makeClaudeNonJsonResponse(): {
  content: Array<{ type: "text"; text: string }>;
} {
  return {
    content: [
      {
        type: "text" as const,
        text: "I apologize, but I cannot analyze this form. The content appears to be corrupted.",
      },
    ],
  };
}

/** Make a Claude response with malformed JSON. */
export function makeClaudeMalformedJsonResponse(): {
  content: Array<{ type: "text"; text: string }>;
} {
  return {
    content: [
      {
        type: "text" as const,
        text: '```json\n{"title": "Broken", "fields": [INVALID_JSON]}\n```',
      },
    ],
  };
}

/** Make a Claude response with an image block instead of text. */
export function makeClaudeImageResponse(): {
  content: Array<{ type: "image"; source: unknown }>;
} {
  return {
    content: [
      {
        type: "image" as const,
        source: { type: "base64", media_type: "image/png", data: "..." },
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Mock form fields for testing autofill and fill logic
// ---------------------------------------------------------------------------

export const SAMPLE_ANALYZED_FIELDS: FormField[] = TAX_FORM_ANALYSIS.fields;

export const SAMPLE_FILLED_FIELDS: FormField[] = TAX_FORM_ANALYSIS.fields.map(
  (field) => {
    const fill = TAX_FORM_AUTOFILL_RESPONSE.find((f) => f.id === field.id);
    if (fill) {
      return {
        ...field,
        value: fill.value,
        confidence: fill.confidence,
        fieldState: "pending" as const,
      };
    }
    return field;
  }
);
