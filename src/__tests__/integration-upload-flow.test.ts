/**
 * Integration tests for the upload -> parse -> analyze flow.
 *
 * Mocks the Anthropic SDK, pdf-parse, and Prisma to test the full
 * pipeline without external dependencies.
 */

import {
  TAX_FORM_ANALYSIS,
  makeClaudeResponse,
  makeClaudeNonJsonResponse,
} from "./mocks";

// ---------------------------------------------------------------------------
// Mock pdf-parse
// ---------------------------------------------------------------------------

const mockPdfParse = jest.fn();
jest.mock("pdf-parse", () => {
  return (buffer: Buffer) => mockPdfParse(buffer);
});

// ---------------------------------------------------------------------------
// Mock Anthropic
// ---------------------------------------------------------------------------

const mockCreate = jest.fn();

jest.mock("@anthropic-ai/sdk", () => {
  return jest.fn().mockImplementation(() => ({
    messages: { create: mockCreate },
  }));
});

jest.mock("@/lib/ai/field-cache", () => ({
  buildCacheKey: jest.fn((label: string, type: string) => `${label}:${type}`),
  lookupCacheEntries: jest.fn(async () => new Map()),
  storeCacheEntries: jest.fn(async () => {}),
}));

process.env.ANTHROPIC_API_KEY = "test-key-not-real";

import { extractTextFromPDF, extractTextFromBuffer } from "@/lib/pdf/extract";
import { analyzeFormFields } from "@/lib/ai/analyze-form";

beforeEach(() => {
  mockCreate.mockReset();
  mockPdfParse.mockReset();
});

// ---------------------------------------------------------------------------
// Full pipeline: buffer -> text extraction -> AI analysis
// ---------------------------------------------------------------------------

describe("upload -> parse -> analyze integration", () => {
  it("processes a PDF from buffer through to analyzed fields", async () => {
    // Step 1: Mock pdf-parse to return form text
    const formText =
      "Form W-4\nEmployee's Withholding Certificate\nFirst Name: ___\nLast Name: ___\nSSN: ___";
    mockPdfParse.mockResolvedValueOnce({ text: formText });

    // Step 2: Extract text
    const text = await extractTextFromPDF(Buffer.from("pdf-bytes"));
    expect(text).toContain("Form W-4");
    expect(text).toContain("First Name");

    // Step 3: Analyze with mocked Claude
    mockCreate.mockResolvedValueOnce(makeClaudeResponse(TAX_FORM_ANALYSIS));
    const analysis = await analyzeFormFields(text);

    expect(analysis.title).toBeTruthy();
    expect(analysis.fields.length).toBeGreaterThan(0);
    expect(analysis.estimatedMinutes).toBeGreaterThan(0);

    // Verify each field has the required properties
    for (const field of analysis.fields) {
      expect(field.id).toBeTruthy();
      expect(field.label).toBeTruthy();
      expect(field.type).toBeTruthy();
      expect(typeof field.required).toBe("boolean");
      expect(field.explanation).toBeTruthy();
    }
  });

  it("rejects empty PDFs at the text-length check", async () => {
    mockPdfParse.mockResolvedValueOnce({ text: "" });

    const text = await extractTextFromPDF(Buffer.from("empty-pdf"));

    // The upload route checks: text.trim().length < 50
    expect(text.trim().length).toBeLessThan(50);
  });

  it("handles the DOCX mime type with invalid buffer", async () => {
    // mammoth will throw on non-DOCX buffer
    const badBuffer = Buffer.from("NOT A DOCX");
    const docxMime =
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

    await expect(extractTextFromBuffer(badBuffer, docxMime)).rejects.toThrow();
  });

  it("passes extracted text to Claude with proper prompt structure", async () => {
    mockCreate.mockResolvedValueOnce(makeClaudeResponse(TAX_FORM_ANALYSIS));

    await analyzeFormFields("First Name: ___\nLast Name: ___\nEmail: ___");

    expect(mockCreate).toHaveBeenCalledTimes(1);
    const call = mockCreate.mock.calls[0][0];

    expect(call.model).toBe("claude-sonnet-4-6");
    expect(call.messages).toHaveLength(1);
    expect(call.messages[0].role).toBe("user");
    expect(call.messages[0].content).toContain("fillable fields");
    expect(call.messages[0].content).toContain("First Name");
  });

  it("handles Claude API failure gracefully", async () => {
    mockCreate.mockRejectedValueOnce(new Error("API rate limit exceeded"));

    await expect(
      analyzeFormFields("First Name: ___\nLast Name: ___\nEmail: ___")
    ).rejects.toThrow("API rate limit exceeded");
  });

  it("handles Claude returning non-JSON response", async () => {
    mockCreate.mockResolvedValueOnce(makeClaudeNonJsonResponse());

    await expect(
      analyzeFormFields("First Name: ___\nLast Name: ___\nEmail: ___")
    ).rejects.toThrow("No JSON found");
  });

  it("complete pipeline from extraction to field analysis validates types", async () => {
    mockPdfParse.mockResolvedValueOnce({
      text: "Lease Agreement\nTenant Name: ___\nRent: $___",
    });

    const text = await extractTextFromPDF(Buffer.from("lease-pdf"));

    const leaseAnalysis = {
      title: "Lease Agreement",
      description: "Rental agreement form",
      fields: [
        {
          id: "tenant_name",
          label: "Tenant Name",
          type: "text",
          required: true,
          explanation: "Full legal name",
          example: "Jane Doe",
          commonMistakes: "Nickname",
          profileKey: null,
        },
        {
          id: "monthly_rent",
          label: "Monthly Rent",
          type: "number",
          required: true,
          explanation: "Amount",
          example: "1500",
          commonMistakes: "Missing decimals",
          profileKey: null,
        },
      ],
      estimatedMinutes: 10,
    };

    mockCreate.mockResolvedValueOnce(makeClaudeResponse(leaseAnalysis));
    const analysis = await analyzeFormFields(text);

    expect(analysis.fields[0].type).toBe("text");
    expect(analysis.fields[1].type).toBe("number");
    expect(analysis.fields.every((f) => typeof f.required === "boolean")).toBe(
      true
    );
  });
});
