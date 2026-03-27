/**
 * Image preprocessing for the FormPilot upload pipeline.
 *
 * This module is implemented in full on feat/image-preprocessing (PR #56).
 * The stub here exists so that:
 *   1. TypeScript can resolve the @/lib/image/preprocess import.
 *   2. Integration tests can mock this module with jest.mock().
 *
 * Once PR #56 is merged, this file will be replaced by the real implementation
 * which uses sharp to auto-rotate, resize, convert HEIC→JPEG, and validate
 * minimum image dimensions.
 */

export interface PreprocessedImage {
  base64: string;
  mimeType: "image/jpeg" | "image/png" | "image/webp";
  width: number;
  height: number;
}

/**
 * Preprocess an image buffer for submission to the Claude vision API.
 *
 * Real implementation (PR #56) behavior:
 * - Validates minimum dimensions (400x400 px)
 * - Auto-rotates using EXIF orientation data
 * - Resizes to fit within 2048x2048 px (preserving aspect ratio)
 * - Converts HEIC/HEIF → JPEG
 * - Returns base64-encoded output + mimeType + output dimensions
 *
 * @throws Error with user-friendly message if image is too small or corrupt
 */
export async function preprocessImage(
  _buffer: Buffer,
  _originalMimeType: string
): Promise<PreprocessedImage> {
  throw new Error(
    "preprocessImage is not yet implemented. This stub will be replaced by PR #56 (feat/image-preprocessing)."
  );
}
