/**
 * Unit tests for the historical suggestion engine.
 * Tests normalization, frequency-counting, sensitive field exclusion,
 * and graceful degradation with no history.
 */

// ---------------------------------------------------------------------------
// Mock Prisma
// ---------------------------------------------------------------------------

const mockFindMany = jest.fn();
const mockMemoryFindMany = jest.fn().mockResolvedValue([]);

jest.mock("@/lib/prisma", () => ({
  prisma: {
    form: {
      findMany: mockFindMany,
    },
    formMemory: {
      findMany: mockMemoryFindMany,
    },
  },
}));

import {
  getSuggestionsFromHistory,
  normalizeLabel,
} from "@/lib/ai/suggestion-engine";
import type { FormField } from "@/lib/ai/analyze-form";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeField(
  id: string,
  label: string,
  value?: string
): FormField {
  return {
    id,
    label,
    type: "text",
    required: false,
    explanation: "",
    example: "",
    commonMistakes: "",
    value,
  };
}

function makePastForm(
  id: string,
  title: string,
  fields: Array<{ label: string; value: string }>,
  updatedAt = new Date()
) {
  return {
    id,
    title,
    fields: fields.map((f, i) => makeField(`f${i}`, f.label, f.value)),
    updatedAt,
  };
}

beforeEach(() => {
  mockFindMany.mockReset();
});

// ---------------------------------------------------------------------------
// normalizeLabel
// ---------------------------------------------------------------------------

describe("normalizeLabel", () => {
  it("lowercases and strips whitespace", () => {
    expect(normalizeLabel("  First Name  ")).toBe("firstname");
  });

  it("strips special characters and punctuation", () => {
    expect(normalizeLabel("Date of Birth")).toBe("dateofbirth");
    expect(normalizeLabel("SSN (last 4)")).toBe("ssnlast4");
    expect(normalizeLabel("E-mail Address")).toBe("emailaddress");
  });

  it("handles empty string", () => {
    expect(normalizeLabel("")).toBe("");
  });

  it("handles all uppercase", () => {
    expect(normalizeLabel("DATE OF BIRTH")).toBe("dateofbirth");
  });
});

// ---------------------------------------------------------------------------
// getSuggestionsFromHistory — basic matching
// ---------------------------------------------------------------------------

describe("getSuggestionsFromHistory — basic matching", () => {
  it("returns a suggestion when a past form has a matching field label", async () => {
    mockFindMany.mockResolvedValueOnce([
      makePastForm("form1", "Tax Return 2024", [
        { label: "Filing Status", value: "Single" },
      ]),
    ]);

    const currentFields = [makeField("f1", "Filing Status")];
    const result = await getSuggestionsFromHistory("user1", currentFields);

    expect(result).toHaveLength(1);
    expect(result[0].fieldId).toBe("f1");
    expect(result[0].value).toBe("Single");
    expect(result[0].source).toBe("Tax Return 2024");
    expect(result[0].confidence).toBe(0.6);
  });

  it("matches case-insensitively", async () => {
    mockFindMany.mockResolvedValueOnce([
      makePastForm("form1", "Form A", [{ label: "first name", value: "John" }]),
    ]);

    const currentFields = [makeField("f1", "First Name")];
    const result = await getSuggestionsFromHistory("user1", currentFields);

    expect(result).toHaveLength(1);
    expect(result[0].value).toBe("John");
  });

  it("matches ignoring punctuation", async () => {
    mockFindMany.mockResolvedValueOnce([
      makePastForm("form1", "Form A", [
        { label: "Date-of-Birth", value: "1990-01-15" },
      ]),
    ]);

    const currentFields = [makeField("f1", "Date of Birth")];
    const result = await getSuggestionsFromHistory("user1", currentFields);

    expect(result).toHaveLength(1);
    expect(result[0].value).toBe("1990-01-15");
  });

  it("returns empty when no fields match", async () => {
    mockFindMany.mockResolvedValueOnce([
      makePastForm("form1", "Form A", [{ label: "Alien Registration Number", value: "A12345678" }]),
    ]);

    const currentFields = [makeField("f1", "Employer Name")];
    const result = await getSuggestionsFromHistory("user1", currentFields);

    expect(result).toHaveLength(0);
  });

  it("returns empty when user has no past forms", async () => {
    mockFindMany.mockResolvedValueOnce([]);

    const currentFields = [makeField("f1", "First Name")];
    const result = await getSuggestionsFromHistory("user1", currentFields);

    expect(result).toHaveLength(0);
  });

  it("returns empty when current form has no fields", async () => {
    // findMany should not even be called when there are no current fields
    mockFindMany.mockResolvedValueOnce([]);

    const result = await getSuggestionsFromHistory("user1", []);

    expect(result).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// getSuggestionsFromHistory — most recent value wins
// ---------------------------------------------------------------------------

describe("getSuggestionsFromHistory — most recent value", () => {
  it("returns the most recent value when multiple past forms match", async () => {
    const newer = new Date("2024-10-01");
    const older = new Date("2023-05-01");

    mockFindMany.mockResolvedValueOnce([
      makePastForm("form2", "Form B (newer)", [{ label: "Employer Name", value: "NewCo" }], newer),
      makePastForm("form1", "Form A (older)", [{ label: "Employer Name", value: "OldCo" }], older),
    ]);

    const currentFields = [makeField("f1", "Employer Name")];
    const result = await getSuggestionsFromHistory("user1", currentFields);

    expect(result).toHaveLength(1);
    expect(result[0].value).toBe("NewCo");
    expect(result[0].source).toBe("Form B (newer)");
  });
});

// ---------------------------------------------------------------------------
// getSuggestionsFromHistory — sensitive field exclusion
// ---------------------------------------------------------------------------

describe("getSuggestionsFromHistory — sensitive field exclusion", () => {
  const sensitiveLabels = [
    "SSN",
    "Social Security Number",
    "Passport Number",
    "Driver License",
    "Driver's License",
    "Bank Account",
    "Routing Number",
    "Credit Card",
    "Credit Card Number",
    "Tax ID",
    "EIN",
    "ITIN",
  ];

  for (const label of sensitiveLabels) {
    it(`excludes '${label}' from suggestions`, async () => {
      mockFindMany.mockResolvedValueOnce([
        makePastForm("form1", "Past Form", [{ label, value: "SENSITIVE_VALUE" }]),
      ]);

      const currentFields = [makeField("f1", label)];
      const result = await getSuggestionsFromHistory("user1", currentFields);

      expect(result).toHaveLength(0);
      expect(result.some((s) => s.value === "SENSITIVE_VALUE")).toBe(false);
    });
  }

  it("still returns non-sensitive fields when sensitive fields are also present", async () => {
    mockFindMany.mockResolvedValueOnce([
      makePastForm("form1", "Past Form", [
        { label: "SSN", value: "123-45-6789" },
        { label: "Employer Name", value: "Acme Corp" },
      ]),
    ]);

    const currentFields = [
      makeField("f1", "SSN"),
      makeField("f2", "Employer Name"),
    ];
    const result = await getSuggestionsFromHistory("user1", currentFields);

    expect(result).toHaveLength(1);
    expect(result[0].fieldId).toBe("f2");
    expect(result[0].value).toBe("Acme Corp");
  });
});

// ---------------------------------------------------------------------------
// getSuggestionsFromHistory — past form data edge cases
// ---------------------------------------------------------------------------

describe("getSuggestionsFromHistory — edge cases", () => {
  it("skips past fields with empty values", async () => {
    mockFindMany.mockResolvedValueOnce([
      makePastForm("form1", "Form A", [{ label: "First Name", value: "" }]),
    ]);

    const currentFields = [makeField("f1", "First Name")];
    const result = await getSuggestionsFromHistory("user1", currentFields);

    expect(result).toHaveLength(0);
  });

  it("handles past forms with malformed fields gracefully", async () => {
    mockFindMany.mockResolvedValueOnce([
      { id: "form1", title: "Form A", fields: null, updatedAt: new Date() },
    ]);

    const currentFields = [makeField("f1", "First Name")];
    // Should not throw
    const result = await getSuggestionsFromHistory("user1", currentFields);
    expect(result).toHaveLength(0);
  });

  it("returns one suggestion per field even when multiple past forms have the same label", async () => {
    mockFindMany.mockResolvedValueOnce([
      makePastForm("form2", "Form B", [{ label: "City", value: "Chicago" }]),
      makePastForm("form1", "Form A", [{ label: "City", value: "Springfield" }]),
    ]);

    const currentFields = [makeField("f1", "City")];
    const result = await getSuggestionsFromHistory("user1", currentFields);

    expect(result).toHaveLength(1);
  });

  it("queries only COMPLETED or FILLING forms", async () => {
    mockFindMany.mockResolvedValueOnce([]);

    const currentFields = [makeField("f1", "First Name")];
    await getSuggestionsFromHistory("user1", currentFields);

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { in: ["COMPLETED", "FILLING"] },
        }),
      })
    );
  });

  it("limits query to 20 past forms", async () => {
    mockFindMany.mockResolvedValueOnce([]);

    const currentFields = [makeField("f1", "First Name")];
    await getSuggestionsFromHistory("user1", currentFields);

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 20 })
    );
  });

  it("passes the userId in the query", async () => {
    mockFindMany.mockResolvedValueOnce([]);

    const currentFields = [makeField("f1", "First Name")];
    await getSuggestionsFromHistory("user-abc", currentFields);

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: "user-abc" }),
      })
    );
  });
});
