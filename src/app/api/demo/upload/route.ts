import { NextRequest, NextResponse } from "next/server";
import { extractTextFromBuffer, getPDFPageCount } from "@/lib/pdf/extract";
import { analyzeFormFields } from "@/lib/ai/analyze-form";
import { prisma } from "@/lib/prisma";
import { log } from "@/lib/logger";

export const maxDuration = 60;

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB for demo
const MAX_PAGES = 3;
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

const ALLOWED_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

function validateMagicBytes(buffer: Buffer, claimedType: string): boolean {
  if (buffer.length < 8) return false;
  switch (claimedType) {
    case "application/pdf":
      return buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46;
    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      return buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04;
    default:
      return false;
  }
}

export async function POST(req: NextRequest) {
  // IP rate limit — 5 per hour
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";
  const key = `ip:${ip}:demo_upload`;
  const now = new Date();
  const windowStart = new Date(now.getTime() - RATE_LIMIT_WINDOW_MS);

  const rl = await prisma.rateLimit.upsert({
    where: { key },
    update: { count: { increment: 1 }, windowStart: { set: windowStart }, updatedAt: now },
    create: { key, count: 1, windowStart: now },
  });

  const inWindow = rl.windowStart >= windowStart;
  if (inWindow && rl.count > RATE_LIMIT_MAX) {
    return NextResponse.json(
      { error: "You've reached the demo upload limit. Sign up for unlimited access." },
      { status: 429 }
    );
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Could not read uploaded file." }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "Demo uploads are limited to 5MB" }, { status: 400 });
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: "Please upload a PDF or Word document" },
      { status: 400 }
    );
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  if (!validateMagicBytes(buffer, file.type)) {
    return NextResponse.json(
      { error: "Please upload a PDF or Word document" },
      { status: 400 }
    );
  }

  // Check page count for PDFs
  if (file.type === "application/pdf") {
    try {
      const pageCount = await getPDFPageCount(buffer);
      if (pageCount > MAX_PAGES) {
        return NextResponse.json(
          { error: "Demo is limited to 3-page documents — sign up for full access" },
          { status: 400 }
        );
      }
    } catch {
      return NextResponse.json({ error: "Could not read PDF. Please try a different file." }, { status: 400 });
    }
  }

  let rawText: string;
  try {
    rawText = await extractTextFromBuffer(buffer, file.type);
  } catch (err) {
    log.warn("demo/upload: text extraction failed", { error: String(err) });
    return NextResponse.json({ error: "Could not extract text from file." }, { status: 400 });
  }

  if (!rawText.trim()) {
    return NextResponse.json(
      { error: "No readable text found. This may be a scanned image — sign up to use image analysis." },
      { status: 400 }
    );
  }

  try {
    const analysis = await analyzeFormFields(rawText);
    return NextResponse.json({
      title: analysis.title,
      category: analysis.category ?? "General",
      fields: analysis.fields,
    });
  } catch (err) {
    log.warn("demo/upload: AI analysis failed", { error: String(err) });
    return NextResponse.json({ error: "Analysis failed. Please try again." }, { status: 500 });
  }
}
