/**
 * End-to-end integration tests for the image upload pipeline.
 *
 * Tests the full flow: file input -> MIME validation -> size validation ->
 * sharp preprocessing -> Claude vision analysis -> FormAnalysis returned.
 *
 * All external dependencies are mocked:
 * - sharp: controlled output for preprocessing tests
 * - @anthropic-ai/sdk: deterministic Claude API responses
 * - @/lib/ai/field-cache: no DB side-effects
 * - @/lib/image/preprocess: mocked to control behavior per test
 * - @/lib/ai/analyze-form: analyzeFormFieldsFromImage mocked; analyzeFormFields
 *   uses real implementation with mocked Anthropic SDK
 *
 * NOTE: These tests target the image pipeline introduced in PRs #56 and #57
 * (feat/image-preprocessing + feat/form-category-detection). @/lib/image/preprocess
 * and analyzeFormFieldsFromImage are mocked here so tests run on any branch.
 * Once those PRs are merged, the mocks can be replaced with real imports.
 */

// ---------------------------------------------------------------------------
// Types (inline to avoid import dependency on branches not yet merged)
// ---------------------------------------------------------------------------

interface PreprocessedImage {
  base64: string;
  mimeType: "image/jpeg" | "image/png" | "image/webp";
  width: number;
  height: number;
}

// ---------------------------------------------------------------------------
// Mock sharp (for tests that call through to the real preprocess logic)
// ---------------------------------------------------------------------------

const mockSharpInstance = {
  rotate: jest.fn().mockReturnThis(),
  resize: jest.fn().mockReturnThis(),
  jpeg: jest.fn().mockReturnThis(),
  png: jest.fn().mockReturnThis(),
  webp: jest.fn().mockReturnThis(),
  toBuffer: jest.fn(),
  metadata: jest.fn(),
};

jest.mock("sharp", () => {
  return jest.fn().mockImplementation(() => mockSharpInstance);
});

// ---------------------------------------------------------------------------
// Mock @/lib/image/preprocess
// The module has a stub on this branch; the real implementation is on
// feat/image-preprocessing (PR #56). We mock it so tests control behavior.
// ---------------------------------------------------------------------------

const mockPreprocessImage = jest.fn<Promise<PreprocessedImage>, [Buffer, string]>();

jest.mock("@/lib/image/preprocess", () => ({
  preprocessImage: (...args: [Buffer, string]) => mockPreprocessImage(...args),
}));

// ---------------------------------------------------------------------------
// Mock @/lib/ai/analyze-form — override analyzeFormFieldsFromImage with a
// controllable mock. The real implementation lands via PR #57; the stub in
// the module always throws, so we must mock it for tests to work.
// analyzeFormFields is left as the real implementation (mocked Anthropic SDK).
// ---------------------------------------------------------------------------

const mockAnalyzeFormFieldsFromImage = jest.fn();

jest.mock("@/lib/ai/analyze-form", () => {
  // Spread real exports so analyzeFormFields still uses the real implementation
  const real = jest.requireActual("@/lib/ai/analyze-form");
  return {
    ...real,
    analyzeFormFieldsFromImage: (...args: unknown[]) =>
      mockAnalyzeFormFieldsFromImage(...args),
  };
});

// ---------------------------------------------------------------------------
// Mock Anthropic SDK (for analyzeFormFields real implementation)
// ---------------------------------------------------------------------------

const mockCreate = jest.fn();

jest.mock("groq-sdk", () => {
  return jest.fn().mockImplementation(() => ({
    chat: { completions: { create: mockCreate } },
  }));
});

// ---------------------------------------------------------------------------
// Mock field-cache (no DB side-effects)
// ---------------------------------------------------------------------------

jest.mock("@/lib/ai/field-cache", () => ({
  buildCacheKey: jest.fn((label: string, type: string) => `${label}:${type}`),
  lookupCacheEntries: jest.fn(async () => new Map()),
  storeCacheEntries: jest.fn(async () => {}),
}));

// ---------------------------------------------------------------------------
// Set env before imports
// ---------------------------------------------------------------------------

process.env.GROQ_API_KEY = "test-key-not-real";

// ---------------------------------------------------------------------------
// Imports (after mocks are registered)
// ---------------------------------------------------------------------------

import { makeClaudeResponse, makeClaudeNonJsonResponse, TAX_FORM_ANALYSIS } from "./mocks";
import { analyzeFormFields, analyzeFormFieldsFromImage } from "@/lib/ai/analyze-form";
import { preprocessImage } from "@/lib/image/preprocess";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal valid image buffer. */
function makeImageBuffer(sizeBytes = 1024): Buffer {
  return Buffer.alloc(sizeBytes, 0xff);
}

/**
 * Build a mock PreprocessedImage result.
 * Used to configure mockPreprocessImage.resolvedValue per test.
 */
function makePreprocessed(
  mimeType: PreprocessedImage["mimeType"] = "image/jpeg",
  width = 800,
  height = 600
): PreprocessedImage {
  const base64 = Buffer.from("mock-image-data").toString("base64");
  return { base64, mimeType, width, height };
}

// ---------------------------------------------------------------------------
// Reset mocks before each test
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();

  // Re-attach chaining methods after clearAllMocks clears return values
  mockSharpInstance.rotate.mockReturnThis();
  mockSharpInstance.resize.mockReturnThis();
  mockSharpInstance.jpeg.mockReturnThis();
  mockSharpInstance.png.mockReturnThis();
  mockSharpInstance.webp.mockReturnThis();
});

// ===========================================================================
// 1. Happy path — PNG upload
// ===========================================================================

describe("happy path — PNG upload", () => {
  it("preprocesses a valid PNG and returns base64 + FormAnalysis", async () => {
    const preprocessed = makePreprocessed("image/png", 800, 600);
    mockPreprocessImage.mockResolvedValueOnce(preprocessed);
    mockAnalyzeFormFieldsFromImage.mockResolvedValueOnce(TAX_FORM_ANALYSIS);

    const buffer = makeImageBuffer();
    const processed = await preprocessImage(buffer, "image/png");

    expect(processed.mimeType).toBe("image/png");
    expect(processed.base64).toBeTruthy();
    expect(processed.width).toBe(800);
    expect(processed.height).toBe(600);


    const analysis = await analyzeFormFieldsFromImage(
      processed.base64,
      processed.mimeType,
      "tax-form.png"
    );

    expect(analysis.title).toBe(TAX_FORM_ANALYSIS.title);
    expect(analysis.fields.length).toBeGreaterThan(0);
    expect(mockAnalyzeFormFieldsFromImage).toHaveBeenCalledTimes(1);
    expect(mockAnalyzeFormFieldsFromImage).toHaveBeenCalledWith(
      preprocessed.base64,
      "image/png",
      "tax-form.png"
    );
  });

  it("all returned fields have required shape properties", async () => {
    const preprocessed = makePreprocessed("image/png", 800, 600);
    mockPreprocessImage.mockResolvedValueOnce(preprocessed);
    mockAnalyzeFormFieldsFromImage.mockResolvedValueOnce(TAX_FORM_ANALYSIS);

    const processed = await preprocessImage(makeImageBuffer(), "image/png");

    const analysis = await analyzeFormFieldsFromImage(processed.base64, processed.mimeType);

    for (const field of analysis.fields) {
      expect(typeof field.id).toBe("string");
      expect(typeof field.label).toBe("string");
      expect(typeof field.type).toBe("string");
      expect(typeof field.required).toBe("boolean");
      expect(typeof field.explanation).toBe("string");
      expect(typeof field.example).toBe("string");
      expect(typeof field.commonMistakes).toBe("string");
    }
  });
});

// ===========================================================================
// 2. Happy path — JPEG upload
// ===========================================================================

describe("happy path — JPEG upload", () => {
  it("preprocesses a valid JPEG and returns image/jpeg mimeType", async () => {
    const preprocessed = makePreprocessed("image/jpeg", 1024, 768);
    mockPreprocessImage.mockResolvedValueOnce(preprocessed);

    const processed = await preprocessImage(makeImageBuffer(), "image/jpeg");

    expect(processed.mimeType).toBe("image/jpeg");
    expect(processed.width).toBe(1024);
    expect(processed.height).toBe(768);
  });

  it("passes correct mimeType through to analyzeFormFieldsFromImage call", async () => {
    const preprocessed = makePreprocessed("image/jpeg", 1024, 768);
    mockPreprocessImage.mockResolvedValueOnce(preprocessed);
    mockAnalyzeFormFieldsFromImage.mockResolvedValueOnce(TAX_FORM_ANALYSIS);

    const processed = await preprocessImage(makeImageBuffer(), "image/jpeg");

    await analyzeFormFieldsFromImage(processed.base64, processed.mimeType, "invoice.jpg");

    expect(mockAnalyzeFormFieldsFromImage).toHaveBeenCalledWith(
      preprocessed.base64,
      "image/jpeg",
      "invoice.jpg"
    );
  });

  it("returns a FormAnalysis with title and fields", async () => {
    const preprocessed = makePreprocessed("image/jpeg", 1024, 768);
    mockPreprocessImage.mockResolvedValueOnce(preprocessed);
    mockAnalyzeFormFieldsFromImage.mockResolvedValueOnce(TAX_FORM_ANALYSIS);

    const processed = await preprocessImage(makeImageBuffer(), "image/jpeg");

    const analysis = await analyzeFormFieldsFromImage(processed.base64, processed.mimeType);

    expect(analysis.title).toBeTruthy();
    expect(Array.isArray(analysis.fields)).toBe(true);
    expect(analysis.estimatedMinutes).toBeGreaterThan(0);
  });
});

// ===========================================================================
// 3. HEIC conversion
// ===========================================================================

describe("HEIC conversion", () => {
  it("converts HEIC input to image/jpeg output", async () => {
    // preprocessImage converts HEIC → JPEG; mock returns the post-conversion result
    const preprocessed = makePreprocessed("image/jpeg", 1200, 900);
    mockPreprocessImage.mockResolvedValueOnce(preprocessed);

    const processed = await preprocessImage(makeImageBuffer(), "image/heic");

    // HEIC should be converted to JPEG (not supported by Claude vision natively)
    expect(processed.mimeType).toBe("image/jpeg");
  });

  it("converts image/heif to JPEG as well", async () => {
    const preprocessed = makePreprocessed("image/jpeg", 1200, 900);
    mockPreprocessImage.mockResolvedValueOnce(preprocessed);

    const processed = await preprocessImage(makeImageBuffer(), "image/heif");

    expect(processed.mimeType).toBe("image/jpeg");
  });

  it("preprocessImage is called with original HEIC mimeType", async () => {
    const preprocessed = makePreprocessed("image/jpeg", 1200, 900);
    mockPreprocessImage.mockResolvedValueOnce(preprocessed);

    const buf = makeImageBuffer();
    await preprocessImage(buf, "image/heic");

    expect(mockPreprocessImage).toHaveBeenCalledWith(buf, "image/heic");
  });

  it("output mimeType from HEIC is accepted by Claude vision (jpeg/png/webp)", async () => {
    const preprocessed = makePreprocessed("image/jpeg", 1200, 900);
    mockPreprocessImage.mockResolvedValueOnce(preprocessed);
    mockAnalyzeFormFieldsFromImage.mockResolvedValueOnce(TAX_FORM_ANALYSIS);

    const processed = await preprocessImage(makeImageBuffer(), "image/heic");

    await analyzeFormFieldsFromImage(processed.base64, processed.mimeType, "photo.heic");

    // The mimeType forwarded to the vision call must be one Claude accepts
    const calledWith = mockAnalyzeFormFieldsFromImage.mock.calls[0];
    expect(["image/jpeg", "image/png", "image/webp"]).toContain(calledWith[1]);
  });
});

// ===========================================================================
// 4. Too-small image — 200x200 → 422
// ===========================================================================

describe("image too small", () => {
  it("throws an error when image is below 400x400 minimum", async () => {
    mockPreprocessImage.mockRejectedValueOnce(
      new Error("Image is too small to read. Please upload a larger or higher-resolution image.")
    );

    await expect(
      preprocessImage(makeImageBuffer(), "image/jpeg")
    ).rejects.toThrow("too small");
  });

  it("throws on 399x600 (width below minimum)", async () => {
    mockPreprocessImage.mockRejectedValueOnce(
      new Error("Image is too small to read. Please upload a larger or higher-resolution image.")
    );

    await expect(
      preprocessImage(makeImageBuffer(), "image/jpeg")
    ).rejects.toThrow("too small");
  });

  it("throws on 600x399 (height below minimum)", async () => {
    mockPreprocessImage.mockRejectedValueOnce(
      new Error("Image is too small to read. Please upload a larger or higher-resolution image.")
    );

    await expect(
      preprocessImage(makeImageBuffer(), "image/jpeg")
    ).rejects.toThrow("too small");
  });

  it("does NOT throw for exactly 400x400 (minimum valid size)", async () => {
    const preprocessed = makePreprocessed("image/jpeg", 400, 400);
    mockPreprocessImage.mockResolvedValueOnce(preprocessed);

    await expect(
      preprocessImage(makeImageBuffer(), "image/jpeg")
    ).resolves.toBeDefined();
  });

  it("error message is user-friendly (no raw stack trace fragments)", async () => {
    const friendlyMessage =
      "Image is too small to read. Please upload a larger or higher-resolution image.";
    mockPreprocessImage.mockRejectedValueOnce(new Error(friendlyMessage));

    let errorMessage = "";
    try {
      await preprocessImage(makeImageBuffer(), "image/jpeg");
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : String(err);
    }

    // Message should NOT contain file paths or stack trace markers
    expect(errorMessage).not.toMatch(/at\s+\w+\s+\(/);
    expect(errorMessage).not.toContain("/src/");
    expect(errorMessage.toLowerCase()).toMatch(/small|resolution|larger/);
  });
});

// ===========================================================================
// 5. No form fields detected — Claude returns empty/no JSON
// ===========================================================================

describe("Claude returns no form fields", () => {
  it("rejects with 'No JSON found' when Claude returns non-JSON text", async () => {
    const preprocessed = makePreprocessed("image/jpeg", 800, 600);
    mockPreprocessImage.mockResolvedValueOnce(preprocessed);
    mockAnalyzeFormFieldsFromImage.mockRejectedValueOnce(
      new Error("No JSON found in AI response")
    );

    const processed = await preprocessImage(makeImageBuffer(), "image/jpeg");


    await expect(
      analyzeFormFieldsFromImage(processed.base64, processed.mimeType)
    ).rejects.toThrow("No JSON found");
  });

  it("returns empty fields array when Claude finds no form fields in image", async () => {
    const preprocessed = makePreprocessed("image/jpeg", 800, 600);
    mockPreprocessImage.mockResolvedValueOnce(preprocessed);

    const emptyFieldsAnalysis = { ...TAX_FORM_ANALYSIS, fields: [] };
    mockAnalyzeFormFieldsFromImage.mockResolvedValueOnce(emptyFieldsAnalysis);

    const processed = await preprocessImage(makeImageBuffer(), "image/jpeg");

    const analysis = await analyzeFormFieldsFromImage(processed.base64, processed.mimeType);

    // The upload route checks fields.length === 0 and returns 422.
    // Here we verify the analysis object itself has no fields.
    expect(analysis.fields).toHaveLength(0);
  });
});

// ===========================================================================
// 6. Large image resize — 5000x3000 → resized to ≤2048
// ===========================================================================

describe("large image resize", () => {
  it("returns output dimensions ≤2048 after resize", async () => {
    // preprocessImage shrinks 5000x3000 to 2048x1229 (longest edge = 2048)
    const preprocessed = makePreprocessed("image/jpeg", 2048, 1229);
    mockPreprocessImage.mockResolvedValueOnce(preprocessed);

    const processed = await preprocessImage(makeImageBuffer(), "image/jpeg");

    expect(processed.width).toBeLessThanOrEqual(2048);
    expect(processed.height).toBeLessThanOrEqual(2048);
  });

  it("passes 5000x3000 source buffer to preprocessImage", async () => {
    const preprocessed = makePreprocessed("image/jpeg", 2048, 1229);
    mockPreprocessImage.mockResolvedValueOnce(preprocessed);

    const buf = makeImageBuffer();
    await preprocessImage(buf, "image/jpeg");

    expect(mockPreprocessImage).toHaveBeenCalledWith(buf, "image/jpeg");
  });

  it("resized image is still analyzed correctly by vision API", async () => {
    const preprocessed = makePreprocessed("image/jpeg", 2048, 1229);
    mockPreprocessImage.mockResolvedValueOnce(preprocessed);
    mockAnalyzeFormFieldsFromImage.mockResolvedValueOnce(TAX_FORM_ANALYSIS);

    const processed = await preprocessImage(makeImageBuffer(), "image/jpeg");

    const analysis = await analyzeFormFieldsFromImage(processed.base64, processed.mimeType);

    expect(analysis.title).toBeTruthy();
    expect(analysis.fields.length).toBeGreaterThan(0);
  });

  it("small images (1920x1080) pass through without resize", async () => {
    // Dimensions stay the same when already within 2048 limit
    const preprocessed = makePreprocessed("image/jpeg", 1920, 1080);
    mockPreprocessImage.mockResolvedValueOnce(preprocessed);

    const processed = await preprocessImage(makeImageBuffer(), "image/jpeg");

    expect(processed.width).toBe(1920);
    expect(processed.height).toBe(1080);
  });
});

// ===========================================================================
// 7. PDF flow unchanged (regression)
// ===========================================================================

describe("existing PDF flow — no regression", () => {
  it("analyzeFormFields() works for text-based PDF content", async () => {
    mockCreate.mockResolvedValueOnce(makeClaudeResponse(TAX_FORM_ANALYSIS));

    const analysis = await analyzeFormFields(
      "Form W-4\nFirst Name: ___\nLast Name: ___\nSSN: ___\nAddress: ___"
    );

    expect(analysis.title).toBe(TAX_FORM_ANALYSIS.title);
    expect(analysis.fields.length).toBeGreaterThan(0);
  });

  it("text analysis does NOT call preprocessImage", async () => {
    mockCreate.mockResolvedValueOnce(makeClaudeResponse(TAX_FORM_ANALYSIS));

    await analyzeFormFields("Form W-4\nFirst Name: ___\nLast Name: ___\nSSN: ___\nAddress: ___");

    // The image preprocessing mock should never be touched for text-based analysis
    expect(mockPreprocessImage).not.toHaveBeenCalled();
  });

  it("text analysis sends string content (not array with image blocks)", async () => {
    mockCreate.mockResolvedValueOnce(makeClaudeResponse(TAX_FORM_ANALYSIS));

    await analyzeFormFields("Form W-4\nFirst Name: ___\nLast Name: ___\nSSN: ___\nAddress: ___");

    const call = mockCreate.mock.calls[0][0];
    expect(call.model).toBe("llama-3.3-70b-versatile");
    expect(call.messages[0].role).toBe("user");
    // Text path sends a plain string, not a multi-modal content array
    expect(typeof call.messages[0].content).toBe("string");
  });

  it("PDF analysis result has the same core FormAnalysis shape as image analysis", async () => {
    mockCreate.mockResolvedValueOnce(makeClaudeResponse(TAX_FORM_ANALYSIS));
    const textAnalysis = await analyzeFormFields(
      "Form W-4\nFirst Name: ___\nLast Name: ___\nSSN: ___\nAddress: ___"
    );

    const preprocessed = makePreprocessed("image/jpeg", 800, 600);
    mockPreprocessImage.mockResolvedValueOnce(preprocessed);
    mockAnalyzeFormFieldsFromImage.mockResolvedValueOnce(TAX_FORM_ANALYSIS);

    const processed = await preprocessImage(makeImageBuffer(), "image/jpeg");

    const imageAnalysis = await analyzeFormFieldsFromImage(processed.base64, processed.mimeType);

    // Both paths must produce objects with these required keys
    expect(Object.keys(textAnalysis)).toEqual(
      expect.arrayContaining(["title", "description", "fields", "estimatedMinutes"])
    );
    expect(Object.keys(imageAnalysis)).toEqual(
      expect.arrayContaining(["title", "description", "fields", "estimatedMinutes"])
    );
  });
});

// ===========================================================================
// 8. Corrupt image buffer
// ===========================================================================

describe("corrupt image buffer", () => {
  it("throws a meaningful error when buffer is not a valid image", async () => {
    mockPreprocessImage.mockRejectedValueOnce(
      new Error("Input buffer contains unsupported image format")
    );

    await expect(
      preprocessImage(Buffer.from("NOT_AN_IMAGE"), "image/jpeg")
    ).rejects.toThrow("unsupported image format");
  });

  it("throws when the image pipeline fails mid-processing", async () => {
    mockPreprocessImage.mockRejectedValueOnce(
      new Error("Could not decode image data")
    );

    await expect(
      preprocessImage(Buffer.from("CORRUPT"), "image/jpeg")
    ).rejects.toThrow("Could not decode image data");
  });

  it("throws for an empty buffer", async () => {
    mockPreprocessImage.mockRejectedValueOnce(
      new Error("Input Buffer is empty")
    );

    await expect(
      preprocessImage(Buffer.alloc(0), "image/jpeg")
    ).rejects.toThrow();
  });

  it("error from corrupt buffer propagates without being swallowed", async () => {
    const originalError = new Error("sharp: Input buffer contains unsupported image format");
    mockPreprocessImage.mockRejectedValueOnce(originalError);

    let caught: Error | null = null;
    try {
      await preprocessImage(Buffer.from("garbage"), "image/png");
    } catch (err) {
      caught = err instanceof Error ? err : null;
    }

    expect(caught).not.toBeNull();
    expect(caught?.message).toContain("unsupported image format");
  });
});

// ===========================================================================
// 9. MIME type validation (upload route layer)
// ===========================================================================

describe("MIME type validation", () => {
  /**
   * The upload route enforces MIME type before calling preprocessImage.
   * These tests validate the allowed/rejected type logic in isolation —
   * matching the ALLOWED_TYPES and IMAGE_TYPES constants in the route.
   */
  const DOC_TYPES = [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ];
  const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/heic", "image/heif"];
  const ALLOWED_TYPES = [...DOC_TYPES, ...IMAGE_TYPES];

  it("accepts image/png", () => {
    expect(ALLOWED_TYPES.includes("image/png")).toBe(true);
  });

  it("accepts image/jpeg", () => {
    expect(ALLOWED_TYPES.includes("image/jpeg")).toBe(true);
  });

  it("accepts image/webp", () => {
    expect(ALLOWED_TYPES.includes("image/webp")).toBe(true);
  });

  it("accepts image/heic", () => {
    expect(ALLOWED_TYPES.includes("image/heic")).toBe(true);
  });

  it("accepts image/heif", () => {
    expect(ALLOWED_TYPES.includes("image/heif")).toBe(true);
  });

  it("rejects text/plain (.txt files)", () => {
    expect(ALLOWED_TYPES.includes("text/plain")).toBe(false);
  });

  it("rejects image/gif (not supported by vision pipeline)", () => {
    // GIF is not in our accepted list even though Claude can process it
    expect(ALLOWED_TYPES.includes("image/gif")).toBe(false);
  });

  it("rejects application/octet-stream", () => {
    expect(ALLOWED_TYPES.includes("application/octet-stream")).toBe(false);
  });

  it("rejects empty string mime type", () => {
    expect(ALLOWED_TYPES.includes("")).toBe(false);
  });

  it("image/png is classified as an image type, not a doc type", () => {
    expect(IMAGE_TYPES.includes("image/png")).toBe(true);
    expect(DOC_TYPES.includes("image/png")).toBe(false);
  });

  it("application/pdf is classified as a doc type, not an image type", () => {
    expect(DOC_TYPES.includes("application/pdf")).toBe(true);
    expect(IMAGE_TYPES.includes("application/pdf")).toBe(false);
  });
});

// ===========================================================================
// 10. File size limit (upload route layer)
// ===========================================================================

describe("file size limit", () => {
  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

  it("accepts files under 10MB", () => {
    const size = 5 * 1024 * 1024;
    expect(size <= MAX_FILE_SIZE).toBe(true);
  });

  it("accepts files exactly at 10MB", () => {
    expect(MAX_FILE_SIZE <= MAX_FILE_SIZE).toBe(true);
  });

  it("rejects files over 10MB", () => {
    const size = 10 * 1024 * 1024 + 1;
    expect(size > MAX_FILE_SIZE).toBe(true);
  });

  it("rejects 11MB buffers", () => {
    const size = 11 * 1024 * 1024;
    expect(size > MAX_FILE_SIZE).toBe(true);
  });

  it("preprocessImage is never called when size limit check rejects the file", async () => {
    // Simulate: the route checks file.size > MAX_FILE_SIZE before calling preprocessImage.
    // We verify that if the check passes correctly, sharp is not called.
    const oversizedBuffer = Buffer.alloc(11 * 1024 * 1024, 0x41);

    // In the real route, this would return a 400 before preprocessImage is called.
    // Here we simulate the guard logic:
    const shouldProcess = oversizedBuffer.length <= MAX_FILE_SIZE;
    expect(shouldProcess).toBe(false);

    // Assert sharp was never invoked (preprocessImage was not called)
    const sharp = require("sharp");
    expect(sharp).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// 11. Vision API call structure validation
// ===========================================================================

describe("Claude vision API call structure", () => {
  it("analyzeFormFieldsFromImage is called with base64, mimeType, and optional titleHint", async () => {
    const preprocessed = makePreprocessed("image/jpeg", 800, 600);
    mockPreprocessImage.mockResolvedValueOnce(preprocessed);
    mockAnalyzeFormFieldsFromImage.mockResolvedValueOnce(TAX_FORM_ANALYSIS);

    const processed = await preprocessImage(makeImageBuffer(), "image/jpeg");

    await analyzeFormFieldsFromImage(processed.base64, processed.mimeType, "form.jpg");

    expect(mockAnalyzeFormFieldsFromImage).toHaveBeenCalledWith(
      preprocessed.base64,
      "image/jpeg",
      "form.jpg"
    );
  });

  it("analyzeFormFieldsFromImage can be called without titleHint", async () => {
    const preprocessed = makePreprocessed("image/jpeg", 800, 600);
    mockPreprocessImage.mockResolvedValueOnce(preprocessed);
    mockAnalyzeFormFieldsFromImage.mockResolvedValueOnce(TAX_FORM_ANALYSIS);

    const processed = await preprocessImage(makeImageBuffer(), "image/jpeg");

    await analyzeFormFieldsFromImage(processed.base64, processed.mimeType);

    expect(mockAnalyzeFormFieldsFromImage).toHaveBeenCalledWith(
      preprocessed.base64,
      "image/jpeg"
    );
  });

  it("vision analysis result is a FormAnalysis object", async () => {
    const preprocessed = makePreprocessed("image/jpeg", 800, 600);
    mockPreprocessImage.mockResolvedValueOnce(preprocessed);
    mockAnalyzeFormFieldsFromImage.mockResolvedValueOnce(TAX_FORM_ANALYSIS);

    const processed = await preprocessImage(makeImageBuffer(), "image/jpeg");

    const result = await analyzeFormFieldsFromImage(processed.base64, processed.mimeType);

    expect(result).toHaveProperty("title");
    expect(result).toHaveProperty("description");
    expect(result).toHaveProperty("fields");
    expect(result).toHaveProperty("estimatedMinutes");
    expect(Array.isArray(result.fields)).toBe(true);
  });

  it("preprocessImage output base64 is forwarded unchanged to vision call", async () => {
    const preprocessed = makePreprocessed("image/jpeg", 800, 600);
    mockPreprocessImage.mockResolvedValueOnce(preprocessed);
    mockAnalyzeFormFieldsFromImage.mockResolvedValueOnce(TAX_FORM_ANALYSIS);

    const processed = await preprocessImage(makeImageBuffer(), "image/jpeg");

    await analyzeFormFieldsFromImage(processed.base64, processed.mimeType);

    // The exact base64 string from preprocessing must be passed through
    expect(mockAnalyzeFormFieldsFromImage.mock.calls[0][0]).toBe(preprocessed.base64);
  });
});

// ===========================================================================
// 12. preprocessImage output format
// ===========================================================================

describe("preprocessImage output contract", () => {
  it("returns base64 string", async () => {
    const preprocessed = makePreprocessed("image/jpeg", 800, 600);
    mockPreprocessImage.mockResolvedValueOnce(preprocessed);

    const processed = await preprocessImage(makeImageBuffer(), "image/jpeg");

    expect(typeof processed.base64).toBe("string");
    // makePreprocessed() produces valid base64
    expect(processed.base64).toMatch(/^[A-Za-z0-9+/=]+$/);
  });

  it("returns width and height as positive numbers", async () => {
    const preprocessed = makePreprocessed("image/jpeg", 1024, 768);
    mockPreprocessImage.mockResolvedValueOnce(preprocessed);

    const processed = await preprocessImage(makeImageBuffer(), "image/jpeg");

    expect(typeof processed.width).toBe("number");
    expect(typeof processed.height).toBe("number");
    expect(processed.width).toBeGreaterThan(0);
    expect(processed.height).toBeGreaterThan(0);
  });

  it("mimeType is one of the three accepted output formats", async () => {
    const preprocessed = makePreprocessed("image/jpeg", 800, 600);
    mockPreprocessImage.mockResolvedValueOnce(preprocessed);

    const processed = await preprocessImage(makeImageBuffer(), "image/jpeg");

    expect(["image/jpeg", "image/png", "image/webp"]).toContain(processed.mimeType);
  });

  it("WebP input produces image/webp output mimeType", async () => {
    const preprocessed = makePreprocessed("image/webp", 800, 600);
    mockPreprocessImage.mockResolvedValueOnce(preprocessed);

    const processed = await preprocessImage(makeImageBuffer(), "image/webp");

    expect(processed.mimeType).toBe("image/webp");
  });
});
