import sharp from "sharp";

export interface PreprocessedImage {
  base64: string;
  mimeType: "image/jpeg" | "image/png" | "image/webp";
  width: number;
  height: number;
  warnings: string[];
}

const MAX_DIMENSION = 2048;
const MIN_DIMENSION = 400;
const SHARP_TIMEOUT_MS = 30_000;

const HEIC_TYPES = new Set(["image/heic", "image/heif"]);

/**
 * Wraps a Sharp pipeline promise with a 30-second timeout.
 * Rejects with a user-facing error if the operation takes too long.
 */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(
        new Error(
          "Image processing timed out. The file may be corrupted or too complex to process."
        )
      );
    }, ms);

    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err: unknown) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

/**
 * Returns a user-facing error for Sharp errors thrown on corrupted or
 * unsupported image data.
 */
function toUserFacingError(err: unknown): Error {
  const message =
    err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();

  if (
    message.includes("input buffer contains unsupported image format") ||
    message.includes("input buffer is empty") ||
    message.includes("vips") ||
    message.includes("unsupported image format") ||
    message.includes("invalid image") ||
    message.includes("corrupt") ||
    message.includes("truncated")
  ) {
    return new Error(
      "The image file appears to be corrupted or in an unsupported format. Please upload a valid JPEG, PNG, WebP, or HEIC image."
    );
  }

  if (err instanceof Error) return err;
  return new Error("An unexpected error occurred while processing the image.");
}

export async function preprocessImage(
  buffer: Buffer,
  originalMimeType: string
): Promise<PreprocessedImage> {
  const warnings: string[] = [];

  // --- Read metadata (validates that the buffer is a readable image) ---
  let metadata: sharp.Metadata;
  try {
    metadata = await withTimeout(sharp(buffer).metadata(), SHARP_TIMEOUT_MS);
  } catch (err) {
    throw toUserFacingError(err);
  }

  const origWidth = metadata.width ?? 0;
  const origHeight = metadata.height ?? 0;

  if (origWidth < MIN_DIMENSION || origHeight < MIN_DIMENSION) {
    throw new Error(
      "Image is too small to read. Please upload a larger or higher-resolution image."
    );
  }

  // --- Build pipeline ---
  let pipeline = sharp(buffer).rotate();

  const longestEdge = Math.max(origWidth, origHeight);
  const wasResized = longestEdge > MAX_DIMENSION;
  if (wasResized) {
    pipeline = pipeline.resize(MAX_DIMENSION, MAX_DIMENSION, {
      fit: "inside",
      withoutEnlargement: true,
    });
  }

  let outputMimeType: PreprocessedImage["mimeType"];

  const mimeTypeLower = originalMimeType.toLowerCase();
  if (HEIC_TYPES.has(mimeTypeLower)) {
    // HEIC/HEIF conversion — some environments (Alpine, older libvips) do not
    // ship HEIC decoder support. Catch explicitly and surface a clear message.
    try {
      pipeline = pipeline.jpeg({ quality: 90 });
      outputMimeType = "image/jpeg";
    } catch (err) {
      throw new Error(
        "HEIC/HEIF images are not supported in this environment. Please convert the image to JPEG or PNG before uploading."
      );
    }
  } else if (mimeTypeLower === "image/png") {
    pipeline = pipeline.png();
    outputMimeType = "image/png";
  } else if (mimeTypeLower === "image/webp") {
    pipeline = pipeline.webp({ quality: 90 });
    outputMimeType = "image/webp";
  } else {
    pipeline = pipeline.jpeg({ quality: 90 });
    outputMimeType = "image/jpeg";
  }

  // --- Execute pipeline with timeout ---
  let outputBuffer: Buffer;
  try {
    outputBuffer = await withTimeout(pipeline.toBuffer(), SHARP_TIMEOUT_MS);
  } catch (err) {
    // HEIC decode failures surface here at runtime (not during pipeline
    // construction), so we check for them before using the generic handler.
    const msg =
      err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
    if (
      HEIC_TYPES.has(mimeTypeLower) &&
      (msg.includes("heif") ||
        msg.includes("heic") ||
        msg.includes("unsupported image format") ||
        msg.includes("vips"))
    ) {
      throw new Error(
        "HEIC/HEIF images are not supported in this environment. Please convert the image to JPEG or PNG before uploading."
      );
    }
    throw toUserFacingError(err);
  }

  // --- Read output metadata ---
  let outputMetadata: sharp.Metadata;
  try {
    outputMetadata = await withTimeout(
      sharp(outputBuffer).metadata(),
      SHARP_TIMEOUT_MS
    );
  } catch (err) {
    throw toUserFacingError(err);
  }

  const outWidth = outputMetadata.width ?? origWidth;
  const outHeight = outputMetadata.height ?? origHeight;

  // --- Validate output dimensions still meet minimum ---
  if (outWidth < MIN_DIMENSION || outHeight < MIN_DIMENSION) {
    warnings.push(
      `Image quality is degraded after processing (output: ${outWidth}x${outHeight}). Results may be less accurate.`
    );
  }

  // --- Warn when a significant resize occurred ---
  if (wasResized) {
    warnings.push(
      `Image was resized from ${origWidth}x${origHeight} to ${outWidth}x${outHeight} to meet size limits.`
    );
  }

  return {
    base64: outputBuffer.toString("base64"),
    mimeType: outputMimeType,
    width: outWidth,
    height: outHeight,
    warnings,
  };
}
