const mockFindMany = jest.fn();
const mockUpdateMany = jest.fn();
const mockUpsert = jest.fn();

jest.mock("@/lib/prisma", () => ({
  prisma: {
    fieldCache: {
      findMany: mockFindMany,
      updateMany: mockUpdateMany,
      upsert: mockUpsert,
    },
  },
}));

import { normalizeLabel, buildCacheKey, lookupCacheEntries, storeCacheEntries } from "../lib/ai/field-cache";
import type { CachedFieldData } from "../lib/ai/field-cache";

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

  it("appends language code for non-English", () => {
    expect(buildCacheKey("First Name", "text", "es")).toBe("first_name:text:es");
  });

  it("does NOT append language code for English", () => {
    expect(buildCacheKey("First Name", "text", "en")).toBe("first_name:text");
  });

  it("does NOT append language code when language is null or undefined", () => {
    expect(buildCacheKey("First Name", "text", null)).toBe("first_name:text");
    expect(buildCacheKey("First Name", "text", undefined)).toBe("first_name:text");
  });
});

describe("lookupCacheEntries", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUpdateMany.mockResolvedValue({ count: 0 });
  });

  it("returns empty map when called with empty keys", async () => {
    const result = await lookupCacheEntries([]);
    expect(result.size).toBe(0);
    expect(mockFindMany).not.toHaveBeenCalled();
  });

  it("returns empty map when no cache rows found", async () => {
    mockFindMany.mockResolvedValue([]);
    const result = await lookupCacheEntries(["first_name:text"]);
    expect(result.size).toBe(0);
  });

  it("maps returned rows to CachedFieldData by cacheKey", async () => {
    mockFindMany.mockResolvedValue([
      {
        cacheKey: "first_name:text",
        explanation: "Your legal first name",
        example: "John",
        commonMistakes: "Using nickname instead of legal name",
        whereToFind: null,
        profileKey: "firstName",
      },
    ]);

    const result = await lookupCacheEntries(["first_name:text", "last_name:text"]);

    expect(result.size).toBe(1);
    const entry = result.get("first_name:text");
    expect(entry?.explanation).toBe("Your legal first name");
    expect(entry?.profileKey).toBe("firstName");
    expect(entry?.whereToFind).toBeNull();
  });

  it("triggers hit count increment in background when rows are found", async () => {
    mockFindMany.mockResolvedValue([
      {
        cacheKey: "email:text",
        explanation: "Your email",
        example: "you@example.com",
        commonMistakes: "Typos",
        whereToFind: null,
        profileKey: "email",
      },
    ]);

    await lookupCacheEntries(["email:text"]);

    // Give the background promise time to resolve
    await new Promise((r) => setImmediate(r));
    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: { cacheKey: { in: ["email:text"] } },
      data: { hitCount: { increment: 1 } },
    });
  });

  it("does NOT call updateMany when no rows match", async () => {
    mockFindMany.mockResolvedValue([]);
    await lookupCacheEntries(["unknown:text"]);
    await new Promise((r) => setImmediate(r));
    expect(mockUpdateMany).not.toHaveBeenCalled();
  });

  it("logs error and continues if updateMany fails", async () => {
    mockFindMany.mockResolvedValue([
      { cacheKey: "email:text", explanation: "e", example: "e", commonMistakes: "m", whereToFind: null, profileKey: null },
    ]);
    mockUpdateMany.mockRejectedValue(new Error("DB connection lost"));
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    const result = await lookupCacheEntries(["email:text"]);
    await new Promise((r) => setImmediate(r));

    expect(result.size).toBe(1);
    expect(errorSpy).toHaveBeenCalledWith(
      "[field-cache] Failed to increment hit counts:",
      expect.any(Error)
    );
    errorSpy.mockRestore();
  });
});

describe("storeCacheEntries", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUpsert.mockResolvedValue({});
  });

  it("does nothing when called with empty entries", async () => {
    await storeCacheEntries([]);
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("upserts each entry with correct fields", async () => {
    const data: CachedFieldData = {
      explanation: "Your legal first name",
      example: "John",
      commonMistakes: "Using nickname",
      whereToFind: null,
      profileKey: "firstName",
    };

    await storeCacheEntries([{ cacheKey: "first_name:text", data }]);

    expect(mockUpsert).toHaveBeenCalledTimes(1);
    const call = mockUpsert.mock.calls[0][0];
    expect(call.where).toEqual({ cacheKey: "first_name:text" });
    expect(call.create.explanation).toBe("Your legal first name");
    expect(call.create.profileKey).toBe("firstName");
    expect(call.update.explanation).toBe("Your legal first name");
    expect(call.create.expiresAt).toBeInstanceOf(Date);
  });

  it("runs all upserts concurrently (Promise.all)", async () => {
    const entries = [
      { cacheKey: "a:text", data: { explanation: "a", example: "a", commonMistakes: "a", whereToFind: null, profileKey: null } },
      { cacheKey: "b:text", data: { explanation: "b", example: "b", commonMistakes: "b", whereToFind: "b", profileKey: "b" } },
    ];

    await storeCacheEntries(entries);
    expect(mockUpsert).toHaveBeenCalledTimes(2);
  });

  it("sets expiresAt 30 days in the future", async () => {
    const before = Date.now();
    await storeCacheEntries([
      { cacheKey: "x:text", data: { explanation: "x", example: "x", commonMistakes: "x", whereToFind: null, profileKey: null } },
    ]);
    const after = Date.now();

    const { expiresAt } = mockUpsert.mock.calls[0][0].create;
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    expect(expiresAt.getTime()).toBeGreaterThanOrEqual(before + thirtyDaysMs - 1000);
    expect(expiresAt.getTime()).toBeLessThanOrEqual(after + thirtyDaysMs + 1000);
  });
});
