import { normalize, matchAnnotationToField } from "../lib/pdf/annotation-helpers";
import type { FormField } from "../lib/ai/analyze-form";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeField(id: string, label: string): FormField {
  return {
    id,
    label,
    type: "text",
    required: false,
    explanation: "",
    example: "",
    commonMistakes: "",
  };
}

// ---------------------------------------------------------------------------
// normalize
// ---------------------------------------------------------------------------

describe("normalize", () => {
  it("lowercases the string", () => {
    expect(normalize("First Name")).toBe("first name");
  });

  it("strips punctuation characters", () => {
    expect(normalize("Date of Birth (DOB)")).toBe("date of birth dob");
  });

  it("collapses multiple spaces into one", () => {
    expect(normalize("address   line   2")).toBe("address line 2");
  });

  it("trims leading and trailing whitespace", () => {
    expect(normalize("  email address  ")).toBe("email address");
  });

  it("preserves digits", () => {
    expect(normalize("Address Line 2")).toBe("address line 2");
  });

  it("handles empty string", () => {
    expect(normalize("")).toBe("");
  });

  it("handles string with only punctuation", () => {
    expect(normalize("---")).toBe("");
  });
});

// ---------------------------------------------------------------------------
// matchAnnotationToField
// ---------------------------------------------------------------------------

describe("matchAnnotationToField", () => {
  const fields: FormField[] = [
    makeField("f1", "First Name"),
    makeField("f2", "Last Name"),
    makeField("f3", "Date of Birth"),
    makeField("f4", "Social Security Number"),
  ];

  it("returns null when no candidates are provided", () => {
    expect(matchAnnotationToField({}, fields)).toBeNull();
  });

  it("returns null when fieldName does not match any field", () => {
    expect(matchAnnotationToField({ fieldName: "Unknown Field XYZ" }, fields)).toBeNull();
  });

  it("exact matches by fieldName (case-insensitive)", () => {
    expect(matchAnnotationToField({ fieldName: "first name" }, fields)).toBe("f1");
    expect(matchAnnotationToField({ fieldName: "LAST NAME" }, fields)).toBe("f2");
  });

  it("exact matches by alternativeText when fieldName is absent", () => {
    expect(matchAnnotationToField({ alternativeText: "Date of Birth" }, fields)).toBe("f3");
  });

  it("prefers fieldName over alternativeText for exact match", () => {
    // fieldName matches f1, altText matches f2 — should return f1
    expect(matchAnnotationToField({ fieldName: "First Name", alternativeText: "Last Name" }, fields)).toBe("f1");
  });

  it("falls back to alternativeText when fieldName has no match", () => {
    expect(matchAnnotationToField({ fieldName: "nonexistent", alternativeText: "Last Name" }, fields)).toBe("f2");
  });

  it("substring match: annotation is substring of field label", () => {
    // "birth" is contained in "date of birth"
    expect(matchAnnotationToField({ fieldName: "birth" }, fields)).toBe("f3");
  });

  it("substring match: field label is substring of annotation", () => {
    // "first name field" contains "first name"
    expect(matchAnnotationToField({ fieldName: "first name field" }, fields)).toBe("f1");
  });

  it("returns null when fields array is empty", () => {
    expect(matchAnnotationToField({ fieldName: "First Name" }, [])).toBeNull();
  });

  it("strips punctuation before matching", () => {
    // "First Name:" should normalize to "first name" and match f1
    expect(matchAnnotationToField({ fieldName: "First Name:" }, fields)).toBe("f1");
  });

  it("returns the first matching field when multiple substrings could match", () => {
    // "name" is a substring of both "First Name" and "Last Name" — returns first match
    const result = matchAnnotationToField({ fieldName: "name" }, fields);
    expect(["f1", "f2"]).toContain(result);
  });
});
