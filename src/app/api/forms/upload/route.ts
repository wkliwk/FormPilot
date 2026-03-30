import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canUploadForm, incrementFormUsage } from "@/lib/subscription";
import { extractTextFromBuffer } from "@/lib/pdf/extract";
import { analyzeFormFields, analyzeFormFieldsFromImage } from "@/lib/ai/analyze-form";
import { preprocessImage } from "@/lib/image/preprocess";
import { checkRateLimit, checkIpRateLimit } from "@/lib/rate-limit";
import { handleApiError } from "@/lib/api-error";
import { log } from "@/lib/logger";
import type { FormAnalysis } from "@/lib/ai/analyze-form";
import { sendEmail } from "@/lib/email";
import FormAnalyzedEmail from "@/emails/FormAnalyzedEmail";

export const maxDuration = 60;

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const DOC_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];
const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/heic", "image/heif"];
const ALLOWED_TYPES = [...DOC_TYPES, ...IMAGE_TYPES];

/** Validate file content matches claimed MIME type via magic bytes */
function validateMagicBytes(buffer: Buffer, claimedType: string): boolean {
  if (buffer.length < 8) return false;
  switch (claimedType) {
    case "application/pdf":
      return buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46; // %PDF
    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      return buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04; // PK (ZIP)
    case "image/png":
      return buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47; // .PNG
    case "image/jpeg":
      return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    case "image/webp":
      return buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 // RIFF
        && buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50; // WEBP
    case "image/heic":
    case "image/heif":
      return buffer[4] === 0x66 && buffer[5] === 0x74 && buffer[6] === 0x79 && buffer[7] === 0x70; // ftyp
    default:
      return false;
  }
}

export async function POST(req: NextRequest) {
  // IP-based rate limit before auth to protect against launch-day abuse (20 req/hour per IP)
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";
  const ipLimit = checkIpRateLimit(ip);
  if (!ipLimit.allowed) {
    return NextResponse.json(
      { error: "Too many requests from this IP. Please try again later." },
      { status: 429, headers: { "Retry-After": String(ipLimit.retryAfter) } }
    );
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimit = checkRateLimit(session.user.id);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfter) } }
    );
  }

  // Check free tier limit
  const uploadCheck = await canUploadForm(session.user.id);
  if (!uploadCheck.allowed) {
    return NextResponse.json(
      {
        error: "Free tier limit reached",
        code: "UPGRADE_REQUIRED",
        formsUsed: uploadCheck.formsUsed,
        limit: uploadCheck.limit,
      },
      { status: 402 }
    );
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "File too large. Max 10MB." }, { status: 400 });
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: "Supported formats: PDF, DOCX, PNG, JPEG, WEBP, HEIC." },
      { status: 400 }
    );
  }

  const start = Date.now();
  const buffer = Buffer.from(await file.arrayBuffer());

  if (!validateMagicBytes(buffer, file.type)) {
    return NextResponse.json(
      { error: "File content does not match its type. Please upload a valid file.", code: "INVALID_FILE" },
      { status: 400 }
    );
  }

  const isImage = IMAGE_TYPES.includes(file.type);

  let analysis: FormAnalysis;
  let sourceType: "PDF" | "WORD" | "IMAGE";

  try {
    if (isImage) {
      const processed = await preprocessImage(buffer, file.type);
      analysis = await analyzeFormFieldsFromImage(processed.base64, processed.mimeType, file.name);
      sourceType = "IMAGE";
    } else {
      const text = await extractTextFromBuffer(buffer, file.type);
      if (!text || text.trim().length < 50) {
        return NextResponse.json(
          { error: "Could not extract readable text from this file. Is it a scanned image PDF?", code: "EXTRACTION_FAILED" },
          { status: 422 }
        );
      }
      analysis = await analyzeFormFields(text);
      sourceType = file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        ? "WORD" : "PDF";
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Processing failed";
    if (message.includes("too small")) {
      return NextResponse.json({ error: message, code: "IMAGE_TOO_SMALL" }, { status: 422 });
    }
    if (message.includes("No JSON found")) {
      return NextResponse.json(
        { error: "Could not identify any form fields. Make sure the document is clearly readable.", code: "AI_PARSE_ERROR" },
        { status: 422 }
      );
    }
    return handleApiError(err, "POST /api/forms/upload");
  }

  try {
    const form = await prisma.form.create({
      data: {
        userId: session.user.id,
        title: analysis.title || file.name,
        sourceType,
        fileBytes: buffer,
        fields: analysis.fields as object,
        status: "ANALYZED",
        category: analysis.category,
      },
    });

    log.info("Form uploaded and analyzed", {
      route: "POST /api/forms/upload",
      durationMs: Date.now() - start,
      userId: session.user.id,
      sourceType,
      fieldCount: analysis.fields.length,
    });

    // Non-blocking usage increment — don't fail the upload if this errors
    incrementFormUsage(session.user.id).catch(() => {});

    // Non-blocking "form is ready" email — skip if no email on session
    if (session.user.email) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://getformpilot.com";
      sendEmail(
        session.user.email,
        `Your form "${form.title}" is ready to fill`,
        FormAnalyzedEmail({ formTitle: form.title, formId: form.id, fieldCount: analysis.fields.length, appUrl })
      ).catch(() => {});
    }

    return NextResponse.json({ formId: form.id });
  } catch (err) {
    return handleApiError(err, "POST /api/forms/upload");
  }
}
