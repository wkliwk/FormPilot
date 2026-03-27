import { validateForm } from "@/lib/validation/validate-form";
import type { FormField } from "@/lib/ai/analyze-form";

function makeField(overrides: Partial<FormField> = {}): FormField {
  return {
    id: "field_1",
    label: "First Name",
    type: "text",
    required: false,
    explanation: "Your first name",
    example: "John",
    commonMistakes: "Don't abbreviate",
    ...overrides,
  };
}

describe("validateForm", () => {
  // --- Required fields ---

  it("returns error for missing required field", () => {
    const fields = [makeField({ id: "f1", required: true })];
    const result = validateForm(fields, {}, {});

    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].rule).toBe("missing_required");
    expect(result.errors[0].fieldId).toBe("f1");
  });

  it("passes when required field has value", () => {
    const fields = [makeField({ id: "f1", required: true })];
    const result = validateForm(fields, { f1: "John" }, {});

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("returns error for required field with whitespace-only value", () => {
    const fields = [makeField({ id: "f1", required: true })];
    const result = validateForm(fields, { f1: "   " }, {});

    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].rule).toBe("missing_required");
  });

  // --- Email format ---

  it("validates email format — valid", () => {
    const fields = [makeField({ id: "f1", label: "Email", profileKey: "email" })];
    const result = validateForm(fields, { f1: "test@example.com" }, {});

    expect(result.errors.filter((e) => e.rule === "invalid_format")).toHaveLength(0);
  });

  it("validates email format — invalid", () => {
    const fields = [makeField({ id: "f1", label: "Email", profileKey: "email" })];
    const result = validateForm(fields, { f1: "notanemail" }, {});

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].rule).toBe("invalid_format");
    expect(result.errors[0].message).toContain("email");
  });

  // --- Phone format ---

  it("validates phone format — valid", () => {
    const fields = [makeField({ id: "f1", label: "Phone Number", profileKey: "phone" })];
    const result = validateForm(fields, { f1: "(555) 123-4567" }, {});

    expect(result.errors.filter((e) => e.rule === "invalid_format")).toHaveLength(0);
  });

  it("validates phone format — invalid", () => {
    const fields = [makeField({ id: "f1", label: "Phone Number", profileKey: "phone" })];
    const result = validateForm(fields, { f1: "abc" }, {});

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].rule).toBe("invalid_format");
  });

  // --- SSN format ---

  it("validates SSN last 4 — valid", () => {
    const fields = [makeField({ id: "f1", label: "SSN", profileKey: "ssn" })];
    const result = validateForm(fields, { f1: "1234" }, {});

    expect(result.errors.filter((e) => e.rule === "invalid_format")).toHaveLength(0);
  });

  it("validates full SSN — valid", () => {
    const fields = [makeField({ id: "f1", label: "Social Security Number", profileKey: "ssn" })];
    const result = validateForm(fields, { f1: "123-45-6789" }, {});

    expect(result.errors.filter((e) => e.rule === "invalid_format")).toHaveLength(0);
  });

  it("validates SSN — invalid", () => {
    const fields = [makeField({ id: "f1", label: "SSN", profileKey: "ssn" })];
    const result = validateForm(fields, { f1: "12" }, {});

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].rule).toBe("invalid_format");
  });

  // --- ZIP format ---

  it("validates ZIP — 5 digit valid", () => {
    const fields = [makeField({ id: "f1", label: "ZIP Code", profileKey: "address.zip" })];
    const result = validateForm(fields, { f1: "90210" }, {});

    expect(result.errors.filter((e) => e.rule === "invalid_format")).toHaveLength(0);
  });

  it("validates ZIP — 9 digit valid", () => {
    const fields = [makeField({ id: "f1", label: "ZIP Code", profileKey: "address.zip" })];
    const result = validateForm(fields, { f1: "90210-1234" }, {});

    expect(result.errors.filter((e) => e.rule === "invalid_format")).toHaveLength(0);
  });

  it("validates ZIP — invalid", () => {
    const fields = [makeField({ id: "f1", label: "ZIP Code", profileKey: "address.zip" })];
    const result = validateForm(fields, { f1: "ABCDE" }, {});

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].rule).toBe("invalid_format");
  });

  // --- Date format ---

  it("validates date — ISO valid", () => {
    const fields = [makeField({ id: "f1", type: "date", label: "Date of Birth" })];
    const result = validateForm(fields, { f1: "1990-01-15" }, {});

    expect(result.errors.filter((e) => e.rule === "invalid_format")).toHaveLength(0);
  });

  it("validates date — US format valid", () => {
    const fields = [makeField({ id: "f1", type: "date", label: "Date of Birth" })];
    const result = validateForm(fields, { f1: "01/15/1990" }, {});

    expect(result.errors.filter((e) => e.rule === "invalid_format")).toHaveLength(0);
  });

  it("validates date — invalid", () => {
    const fields = [makeField({ id: "f1", type: "date", label: "Date of Birth" })];
    const result = validateForm(fields, { f1: "not a date" }, {});

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].rule).toBe("invalid_format");
  });

  // --- Low confidence warnings ---

  it("warns on low confidence accepted field", () => {
    const fields = [makeField({ id: "f1", confidence: 0.3, value: "John" })];
    const result = validateForm(fields, { f1: "John" }, { f1: "accepted" });

    expect(result.warnings.filter((w) => w.rule === "low_confidence")).toHaveLength(1);
  });

  it("does not warn on high confidence field", () => {
    const fields = [makeField({ id: "f1", confidence: 0.9, value: "John" })];
    const result = validateForm(fields, { f1: "John" }, { f1: "accepted" });

    expect(result.warnings.filter((w) => w.rule === "low_confidence")).toHaveLength(0);
  });

  // --- Empty optional warnings ---

  it("warns on empty optional field", () => {
    const fields = [makeField({ id: "f1", required: false })];
    const result = validateForm(fields, {}, {});

    expect(result.warnings.filter((w) => w.rule === "empty_optional")).toHaveLength(1);
  });

  it("does not warn on empty optional if rejected/skipped", () => {
    const fields = [makeField({ id: "f1", required: false })];
    const result = validateForm(fields, {}, { f1: "rejected" });

    expect(result.warnings.filter((w) => w.rule === "empty_optional")).toHaveLength(0);
  });

  // --- Completeness ---

  it("calculates completeness correctly", () => {
    const fields = [
      makeField({ id: "f1" }),
      makeField({ id: "f2" }),
      makeField({ id: "f3" }),
      makeField({ id: "f4" }),
    ];
    const result = validateForm(fields, { f1: "a", f2: "b" }, {});

    expect(result.completeness).toBe(50);
  });

  it("returns 100% completeness when all fields filled", () => {
    const fields = [makeField({ id: "f1" }), makeField({ id: "f2" })];
    const result = validateForm(fields, { f1: "a", f2: "b" }, {});

    expect(result.completeness).toBe(100);
  });

  it("returns 100% for empty field list", () => {
    const result = validateForm([], {}, {});

    expect(result.completeness).toBe(100);
    expect(result.valid).toBe(true);
  });

  // --- Combined scenarios ---

  it("handles multiple errors and warnings together", () => {
    const fields = [
      makeField({ id: "f1", required: true, label: "Full Name" }),
      makeField({ id: "f2", label: "Email", profileKey: "email" }),
      makeField({ id: "f3", label: "Phone", profileKey: "phone", confidence: 0.2, value: "abc" }),
    ];
    const result = validateForm(
      fields,
      { f2: "bad-email", f3: "abc" },
      { f3: "pending" }
    );

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(2); // missing required + invalid email
    expect(result.warnings.filter((w) => w.rule === "low_confidence")).toHaveLength(1);
    expect(result.completeness).toBe(67); // 2 of 3 filled
  });

  // --- Label-based detection ---

  it("detects email by label even without profileKey", () => {
    const fields = [makeField({ id: "f1", label: "Email Address" })];
    const result = validateForm(fields, { f1: "bad" }, {});

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].rule).toBe("invalid_format");
  });

  it("detects zip by label even without profileKey", () => {
    const fields = [makeField({ id: "f1", label: "Postal Code / Zip" })];
    const result = validateForm(fields, { f1: "abc" }, {});

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].rule).toBe("invalid_format");
  });
});
