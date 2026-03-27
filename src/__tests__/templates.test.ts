/**
 * Unit tests for template field matching logic.
 * API route tests require DB mocking — these test the core matching.
 */

// Inline the normalize function for testing (same logic as apply-template route)
function normalizeLabel(label: string): string {
  return label.toLowerCase().trim().replace(/[^a-z0-9]/g, "");
}

function applyTemplate(
  fields: Array<{ id: string; label: string; value?: string }>,
  templateData: Record<string, string>
): Array<{ id: string; label: string; value?: string; applied?: boolean }> {
  const templateMap = new Map<string, string>();
  for (const [label, value] of Object.entries(templateData)) {
    templateMap.set(normalizeLabel(label), value);
  }

  return fields.map((field) => {
    const normalizedLabel = normalizeLabel(field.label);
    const templateValue = templateMap.get(normalizedLabel);

    if (templateValue && !field.value) {
      return { ...field, value: templateValue, applied: true };
    }
    return field;
  });
}

// Sensitive field stripping
const SENSITIVE_KEYS = new Set([
  "ssn", "passportNumber", "driverLicense", "bankAccount", "routingNumber", "creditCard",
]);

function stripSensitiveFromTemplate(
  fields: Array<{ label: string; value: string; profileKey?: string }>
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const field of fields) {
    if (field.profileKey && SENSITIVE_KEYS.has(field.profileKey)) continue;
    result[field.label] = field.value;
  }
  return result;
}

describe("Template field matching", () => {
  it("matches fields by exact label", () => {
    const fields = [
      { id: "f1", label: "First Name" },
      { id: "f2", label: "Last Name" },
    ];
    const template = { "First Name": "John", "Last Name": "Doe" };
    const result = applyTemplate(fields, template);

    expect(result[0].value).toBe("John");
    expect(result[1].value).toBe("Doe");
  });

  it("matches case-insensitively", () => {
    const fields = [{ id: "f1", label: "first name" }];
    const template = { "First Name": "John" };
    const result = applyTemplate(fields, template);

    expect(result[0].value).toBe("John");
  });

  it("matches ignoring special characters", () => {
    const fields = [{ id: "f1", label: "Date of Birth" }];
    const template = { "Date-of-Birth": "1990-01-15" };
    const result = applyTemplate(fields, template);

    expect(result[0].value).toBe("1990-01-15");
  });

  it("does not overwrite existing values", () => {
    const fields = [{ id: "f1", label: "First Name", value: "Jane" }];
    const template = { "First Name": "John" };
    const result = applyTemplate(fields, template);

    expect(result[0].value).toBe("Jane");
  });

  it("leaves unmatched fields unchanged", () => {
    const fields = [
      { id: "f1", label: "First Name" },
      { id: "f2", label: "Employer EIN" },
    ];
    const template = { "First Name": "John" };
    const result = applyTemplate(fields, template);

    expect(result[0].value).toBe("John");
    expect(result[1].value).toBeUndefined();
  });

  it("handles empty template", () => {
    const fields = [{ id: "f1", label: "Name" }];
    const result = applyTemplate(fields, {});

    expect(result[0].value).toBeUndefined();
  });

  it("handles empty fields", () => {
    const result = applyTemplate([], { "Name": "John" });
    expect(result).toHaveLength(0);
  });
});

describe("Sensitive field stripping", () => {
  it("strips SSN from templates", () => {
    const fields = [
      { label: "Name", value: "John", profileKey: "firstName" },
      { label: "SSN", value: "123-45-6789", profileKey: "ssn" },
    ];
    const result = stripSensitiveFromTemplate(fields);

    expect(result["Name"]).toBe("John");
    expect(result["SSN"]).toBeUndefined();
  });

  it("strips all sensitive keys", () => {
    const fields = [
      { label: "Passport", value: "AB123", profileKey: "passportNumber" },
      { label: "Bank", value: "1234", profileKey: "bankAccount" },
      { label: "Routing", value: "5678", profileKey: "routingNumber" },
      { label: "License", value: "DL99", profileKey: "driverLicense" },
      { label: "Card", value: "4111", profileKey: "creditCard" },
    ];
    const result = stripSensitiveFromTemplate(fields);

    expect(Object.keys(result)).toHaveLength(0);
  });

  it("keeps non-sensitive fields", () => {
    const fields = [
      { label: "Email", value: "a@b.com", profileKey: "email" },
      { label: "Phone", value: "555-1234", profileKey: "phone" },
      { label: "Employer", value: "Acme", profileKey: "employerName" },
    ];
    const result = stripSensitiveFromTemplate(fields);

    expect(Object.keys(result)).toHaveLength(3);
  });
});

describe("Label normalization", () => {
  it("handles whitespace", () => {
    expect(normalizeLabel("  First Name  ")).toBe("firstname");
  });

  it("handles mixed case", () => {
    expect(normalizeLabel("DATE OF BIRTH")).toBe("dateofbirth");
  });

  it("strips punctuation", () => {
    expect(normalizeLabel("SSN (last 4)")).toBe("ssnlast4");
  });

  it("handles empty string", () => {
    expect(normalizeLabel("")).toBe("");
  });
});
