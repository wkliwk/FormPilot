import sharp from "sharp";
import { preprocessImage } from "@/lib/image/preprocess";

// Helper: create a test image buffer of given dimensions
async function createTestImage(
  width: number,
  height: number,
  format: "png" | "jpeg" | "webp" = "png"
): Promise<Buffer> {
  const channels = 3;
  const raw = Buffer.alloc(width * height * channels, 128);
  let pipeline = sharp(raw, { raw: { width, height, channels } });

  if (format === "png") pipeline = pipeline.png();
  else if (format === "jpeg") pipeline = pipeline.jpeg();
  else pipeline = pipeline.webp();

  return pipeline.toBuffer();
}

describe("preprocessImage", () => {
  it("processes a valid PNG image", async () => {
    const buffer = await createTestImage(800, 600, "png");
    const result = await preprocessImage(buffer, "image/png");

    expect(result.mimeType).toBe("image/png");
    expect(result.base64).toBeTruthy();
    expect(result.width).toBeLessThanOrEqual(800);
    expect(result.height).toBeLessThanOrEqual(600);
  });

  it("processes a valid JPEG image", async () => {
    const buffer = await createTestImage(800, 600, "jpeg");
    const result = await preprocessImage(buffer, "image/jpeg");

    expect(result.mimeType).toBe("image/jpeg");
    expect(result.base64).toBeTruthy();
  });

  it("processes a valid WEBP image", async () => {
    const buffer = await createTestImage(800, 600, "webp");
    const result = await preprocessImage(buffer, "image/webp");

    expect(result.mimeType).toBe("image/webp");
    expect(result.base64).toBeTruthy();
  });

  it("rejects images smaller than 400x400", async () => {
    const buffer = await createTestImage(300, 300);

    await expect(preprocessImage(buffer, "image/png")).rejects.toThrow(
      "Image is too small to read"
    );
  });

  it("rejects images with one dimension below 400", async () => {
    const buffer = await createTestImage(500, 200);

    await expect(preprocessImage(buffer, "image/png")).rejects.toThrow(
      "Image is too small to read"
    );
  });

  it("resizes images larger than 2048px", async () => {
    const buffer = await createTestImage(4000, 3000, "jpeg");
    const result = await preprocessImage(buffer, "image/jpeg");

    expect(result.width).toBeLessThanOrEqual(2048);
    expect(result.height).toBeLessThanOrEqual(2048);
  });

  it("does not upscale small valid images", async () => {
    const buffer = await createTestImage(500, 500, "png");
    const result = await preprocessImage(buffer, "image/png");

    expect(result.width).toBeLessThanOrEqual(500);
    expect(result.height).toBeLessThanOrEqual(500);
  });

  it("converts HEIC to JPEG", async () => {
    // We can't easily create HEIC in tests, but we can verify the format logic
    // by passing a regular image with HEIC mime type
    const buffer = await createTestImage(800, 600, "jpeg");
    const result = await preprocessImage(buffer, "image/heic");

    expect(result.mimeType).toBe("image/jpeg");
  });

  it("returns valid base64 string", async () => {
    const buffer = await createTestImage(800, 600);
    const result = await preprocessImage(buffer, "image/png");

    // Verify base64 is valid by decoding
    const decoded = Buffer.from(result.base64, "base64");
    expect(decoded.length).toBeGreaterThan(0);
  });

  it("maintains aspect ratio when resizing", async () => {
    const buffer = await createTestImage(4000, 2000, "jpeg");
    const result = await preprocessImage(buffer, "image/jpeg");

    // Original ratio is 2:1, output should be close
    const ratio = result.width / result.height;
    expect(ratio).toBeCloseTo(2, 0);
  });
});
