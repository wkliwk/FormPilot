/**
 * Unit tests for src/lib/ai/analyze-form.ts
 *
 * Mocks the Anthropic SDK so no real API calls are made.
 * Tests analyzeFormFields, autofillFields, and stripSensitiveFields.
 */

import {
  TAX_FORM_ANALYSIS,
  TAX_FORM_AUTOFILL_RESPONSE,
  SAMPLE_ANALYZED_FIELDS,
  makeClaudeResponse,
  makeClaudeNonJsonResponse,
  makeClaudeMalformedJsonResponse,
  makeClaudeImageResponse,
} from "./mocks";
import { COMPLETE_PROFILE, MINIMAL_PROFILE, EMPTY_PROFILE } from "./mocks";
import { TAX_FORM_W4_TEXT, OVERSIZED_TEXT, IMMIGRATION_FORM_TEXT } from "./mocks";

// ---------------------------------------------------------------------------
// Mock the Groq client
// ---------------------------------------------------------------------------

const mockCreate = jest.fn();

jest.mock("groq-sdk", () => {
  return jest.fn().mockImplementation(() => ({
    chat: { completions: { create: mockCreate } },
  }));
});

// Mock the field-cache so we don't need a database
jest.mock("@/lib/ai/field-cache", () => ({
  buildCacheKey: jest.fn((label: string, type: string) => `${label}:${type}`),
  lookupCacheEntries: jest.fn(async () => new Map()),
  storeCacheEntries: jest.fn(async () => {}),
}));

// Set env var so getClient() doesn't throw
process.env.GROQ_API_KEY = "test-key-not-real";

// Import after mocks are set up
import {
  analyzeFormFields,
  autofillFields,
  stripSensitiveFields,
} from "@/lib/ai/analyze-form";

beforeEach(() => {
  mockCreate.mockReset();
});

// ---------------------------------------------------------------------------
// stripSensitiveFields
// ---------------------------------------------------------------------------

describe("stripSensitiveFields", () => {
  it("removes SSN, passport, driver license, bank, routing, and credit card", () => {
    const result = stripSensitiveFields(COMPLETE_PROFILE);

    expect(result.ssn).toBeUndefined();
    expect(result.passportNumber).toBeUndefined();
    expect(result.driverLicense).toBeUndefined();
    expect(result.bankAccount).toBeUndefined();
    expect(result.routingNumber).toBeUndefined();
    expect(result.creditCard).toBeUndefined();
  });

  it("preserves non-sensitive fields", () => {
    const result = stripSensitiveFields(COMPLETE_PROFILE);

    expect(result.firstName).toBe("Jane");
    expect(result.lastName).toBe("Doe");
    expect(result.email).toBe("jane.doe@example.com");
    expect(result.phone).toBe("(555) 123-4567");
    expect(result.employerName).toBe("Acme Corp");
  });

  it("returns empty object for empty input", () => {
    expect(stripSensitiveFields({})).toEqual({});
  });

  it("returns same object when no sensitive keys present", () => {
    const safe = { firstName: "Jane", email: "jane@example.com" };
    expect(stripSensitiveFields(safe)).toEqual(safe);
  });
});

// ---------------------------------------------------------------------------
// analyzeFormFields
// ---------------------------------------------------------------------------

describe("analyzeFormFields", () => {
  it("returns parsed form analysis from Claude response", async () => {
    mockCreate.mockResolvedValueOnce(makeClaudeResponse(TAX_FORM_ANALYSIS));

    const result = await analyzeFormFields(TAX_FORM_W4_TEXT);

    expect(result.title).toBe(TAX_FORM_ANALYSIS.title);
    expect(result.fields).toHaveLength(TAX_FORM_ANALYSIS.fields.length);
    expect(result.estimatedMinutes).toBe(10);
    expect(result.fields[0].id).toBe("first_name");
    expect(result.fields[0].profileKey).toBe("firstName");
  });

  it("truncates text longer than 50,000 characters", async () => {
    mockCreate.mockResolvedValueOnce(makeClaudeResponse(TAX_FORM_ANALYSIS));

    await analyzeFormFields(OVERSIZED_TEXT);

    const calledWith = mockCreate.mock.calls[0][0];
    const promptText = calledWith.messages[0].content;
    // The prompt includes the form text; verify it was truncated
    expect(promptText.length).toBeLessThanOrEqual(60000); // prompt overhead + 50k
  });

  it("throws when Claude returns no JSON", async () => {
    mockCreate.mockResolvedValueOnce(makeClaudeNonJsonResponse());

    await expect(analyzeFormFields(TAX_FORM_W4_TEXT)).rejects.toThrow(
      "No JSON found in AI response"
    );
  });

  it("throws when Claude returns malformed JSON", async () => {
    mockCreate.mockResolvedValueOnce(makeClaudeMalformedJsonResponse());

    await expect(analyzeFormFields(TAX_FORM_W4_TEXT)).rejects.toThrow(
      "Failed to parse AI response"
    );
  });

  it("throws when AI returns empty content", async () => {
    mockCreate.mockResolvedValueOnce(makeClaudeImageResponse());

    await expect(analyzeFormFields(TAX_FORM_W4_TEXT)).rejects.toThrow(
      "Empty response from AI"
    );
  });

  it("throws when Claude returns valid JSON that fails Zod validation", async () => {
    const invalidAnalysis = {
      title: "Test",
      description: "Test",
      fields: [{ id: "x", label: "X" }], // missing required fields
      estimatedMinutes: 5,
    };
    mockCreate.mockResolvedValueOnce(makeClaudeResponse(invalidAnalysis));

    await expect(analyzeFormFields(TAX_FORM_W4_TEXT)).rejects.toThrow(
      "Failed to parse AI response"
    );
  });

  it("sends the correct model and max_tokens to Groq", async () => {
    mockCreate.mockResolvedValueOnce(makeClaudeResponse(TAX_FORM_ANALYSIS));

    await analyzeFormFields(TAX_FORM_W4_TEXT);

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "llama-3.3-70b-versatile",
        max_tokens: 4096,
      })
    );
  });

  it("returns a category alongside the analysis", async () => {
    mockCreate.mockResolvedValueOnce(makeClaudeResponse(TAX_FORM_ANALYSIS));

    const result = await analyzeFormFields(TAX_FORM_W4_TEXT);

    // W-4 text contains tax keywords — should be detected as TAX
    expect(result.category).toBe("TAX");
  });

  it("prepends the category system prompt to the Claude message", async () => {
    mockCreate.mockResolvedValueOnce(makeClaudeResponse(TAX_FORM_ANALYSIS));

    await analyzeFormFields(TAX_FORM_W4_TEXT);

    const call = mockCreate.mock.calls[0][0];
    const content: string = call.messages[0].content;
    // TAX category prompt should include IRS-specific instructions
    expect(content).toContain("IRS");
  });

  it("detects IMMIGRATION category for immigration form text", async () => {
    mockCreate.mockResolvedValueOnce(makeClaudeResponse(TAX_FORM_ANALYSIS));

    const result = await analyzeFormFields(IMMIGRATION_FORM_TEXT);

    expect(result.category).toBe("IMMIGRATION");
  });
});

// ---------------------------------------------------------------------------
// autofillFields
// ---------------------------------------------------------------------------

describe("autofillFields", () => {
  it("merges fill values and confidence scores into fields", async () => {
    mockCreate.mockResolvedValueOnce(
      makeClaudeResponse(TAX_FORM_AUTOFILL_RESPONSE)
    );

    const result = await autofillFields(
      SAMPLE_ANALYZED_FIELDS,
      COMPLETE_PROFILE
    );

    const firstName = result.find((f) => f.id === "first_name");
    expect(firstName?.value).toBe("Jane");
    expect(firstName?.confidence).toBe(1.0);
    expect(firstName?.fieldState).toBe("pending");

    const address = result.find((f) => f.id === "address");
    expect(address?.value).toBe("123 Main St");
    expect(address?.confidence).toBe(1.0);
  });

  it("preserves unfilled fields without modification", async () => {
    mockCreate.mockResolvedValueOnce(
      makeClaudeResponse(TAX_FORM_AUTOFILL_RESPONSE)
    );

    const result = await autofillFields(
      SAMPLE_ANALYZED_FIELDS,
      COMPLETE_PROFILE
    );

    const checkbox = result.find((f) => f.id === "multiple_jobs");
    expect(checkbox?.value).toBeUndefined();
    expect(checkbox?.confidence).toBeUndefined();
  });

  it("directly fills sensitive fields from profile without AI", async () => {
    // Mock: Claude returns no fill for SSN
    mockCreate.mockResolvedValueOnce(makeClaudeResponse([]));

    const result = await autofillFields(
      SAMPLE_ANALYZED_FIELDS,
      COMPLETE_PROFILE
    );

    const ssn = result.find((f) => f.id === "ssn");
    // ssn has profileKey "ssn" which is in SENSITIVE_KEYS, so it should
    // be direct-filled from profile
    expect(ssn?.value).toBe("123-45-6789");
    expect(ssn?.confidence).toBe(1.0);
  });

  it("strips sensitive fields before sending to Claude", async () => {
    mockCreate.mockResolvedValueOnce(makeClaudeResponse([]));

    await autofillFields(SAMPLE_ANALYZED_FIELDS, COMPLETE_PROFILE);

    const calledWith = mockCreate.mock.calls[0][0];
    const promptText = calledWith.messages[0].content;

    // SSN value should not appear in the prompt sent to Claude
    expect(promptText).not.toContain("123-45-6789");
    expect(promptText).not.toContain("X12345678"); // passport
    expect(promptText).not.toContain("D400-1234-5678"); // driver license
  });

  it("returns fields unchanged when Claude returns no JSON array", async () => {
    mockCreate.mockResolvedValueOnce(makeClaudeNonJsonResponse());

    const result = await autofillFields(
      SAMPLE_ANALYZED_FIELDS,
      MINIMAL_PROFILE
    );

    // Fields should be returned unchanged (no crash)
    expect(result).toHaveLength(SAMPLE_ANALYZED_FIELDS.length);
    // No values should be set (except sensitive direct-fill)
    const nonSensitive = result.filter(
      (f) => !["ssn", "passportNumber", "driverLicense"].includes(f.profileKey || "")
    );
    for (const field of nonSensitive) {
      expect(field.value).toBeUndefined();
    }
  });

  it("returns fields unchanged when Claude returns invalid JSON", async () => {
    mockCreate.mockResolvedValueOnce(makeClaudeMalformedJsonResponse());

    const result = await autofillFields(
      SAMPLE_ANALYZED_FIELDS,
      MINIMAL_PROFILE
    );

    expect(result).toHaveLength(SAMPLE_ANALYZED_FIELDS.length);
  });

  it("works with an empty profile", async () => {
    mockCreate.mockResolvedValueOnce(makeClaudeResponse([]));

    const result = await autofillFields(
      SAMPLE_ANALYZED_FIELDS,
      EMPTY_PROFILE
    );

    expect(result).toHaveLength(SAMPLE_ANALYZED_FIELDS.length);
  });
});
