import { normalizeLabel, buildCacheKey } from "../lib/ai/field-cache";

// These tests cover the pure functions only — DB operations require a live
// Prisma connection and are not exercised here (integration tests would handle those).

describe("normalizeLabel", () => {
  it("lowercases and trims the label", () => {
    expect(normalizeLabel("  First Name  ")).toBe("first_name");
  });

  it("replaces spaces with underscores", () => {
    expect(normalizeLabel("Date of Birth")).toBe("date_of_birth");
  });

  it("replaces consecutive non-alphanumeric chars with a single underscore", () => {
    expect(normalizeLabel("Social Security # (SSN)")).toBe("social_security_ssn");
  });

  it("strips leading and trailing underscores after replacement", () => {
    expect(normalizeLabel("--Field Name--")).toBe("field_name");
  });

  it("handles already-normalized labels unchanged", () => {
    expect(normalizeLabel("email")).toBe("email");
  });

  it("handles labels with numbers", () => {
    expect(normalizeLabel("Address Line 2")).toBe("address_line_2");
  });
});

describe("buildCacheKey", () => {
  it("combines normalized label and lowercased type with colon separator", () => {
    expect(buildCacheKey("First Name", "text")).toBe("first_name:text");
  });

  it("lowercases the type", () => {
    expect(buildCacheKey("Date of Birth", "DATE")).toBe("date_of_birth:date");
  });

  it("trims whitespace from type", () => {
    expect(buildCacheKey("Email", "  text  ")).toBe("email:text");
  });

  it("produces the same key for semantically identical labels", () => {
    const key1 = buildCacheKey("First Name", "text");
    const key2 = buildCacheKey("  first name  ", "TEXT");
    expect(key1).toBe(key2);
  });

  it("produces different keys for different field types", () => {
    const textKey = buildCacheKey("Date", "text");
    const dateKey = buildCacheKey("Date", "date");
    expect(textKey).not.toBe(dateKey);
  });

  it("produces different keys for different labels", () => {
    const firstKey = buildCacheKey("First Name", "text");
    const lastKey = buildCacheKey("Last Name", "text");
    expect(firstKey).not.toBe(lastKey);
  });
});
