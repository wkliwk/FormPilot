import sharp from "sharp";

export interface PreprocessedImage {
  base64: string;
  mimeType: "image/jpeg" | "image/png" | "image/webp";
  width: number;
  height: number;
}

const MAX_DIMENSION = 2048;
const MIN_DIMENSION = 400;

const HEIC_TYPES = new Set(["image/heic", "image/heif"]);

export async function preprocessImage(
  buffer: Buffer,
  originalMimeType: string
): Promise<PreprocessedImage> {
  const metadata = await sharp(buffer).metadata();
  const origWidth = metadata.width ?? 0;
  const origHeight = metadata.height ?? 0;

  if (origWidth < MIN_DIMENSION || origHeight < MIN_DIMENSION) {
    throw new Error(
      "Image is too small to read. Please upload a larger or higher-resolution image."
    );
  }

  let pipeline = sharp(buffer).rotate();

  const longestEdge = Math.max(origWidth, origHeight);
  if (longestEdge > MAX_DIMENSION) {
    pipeline = pipeline.resize(MAX_DIMENSION, MAX_DIMENSION, {
      fit: "inside",
      withoutEnlargement: true,
    });
  }

  let outputMimeType: PreprocessedImage["mimeType"];

  if (HEIC_TYPES.has(originalMimeType.toLowerCase())) {
    pipeline = pipeline.jpeg({ quality: 90 });
    outputMimeType = "image/jpeg";
  } else if (originalMimeType === "image/png") {
    pipeline = pipeline.png();
    outputMimeType = "image/png";
  } else if (originalMimeType === "image/webp") {
    pipeline = pipeline.webp({ quality: 90 });
    outputMimeType = "image/webp";
  } else {
    pipeline = pipeline.jpeg({ quality: 90 });
    outputMimeType = "image/jpeg";
  }

  const outputBuffer = await pipeline.toBuffer();
  const outputMetadata = await sharp(outputBuffer).metadata();

  return {
    base64: outputBuffer.toString("base64"),
    mimeType: outputMimeType,
    width: outputMetadata.width ?? origWidth,
    height: outputMetadata.height ?? origHeight,
  };
}
