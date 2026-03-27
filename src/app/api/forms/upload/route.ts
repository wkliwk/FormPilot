import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { extractTextFromBuffer } from "@/lib/pdf/extract";
import { analyzeFormFields, analyzeFormFieldsFromImage } from "@/lib/ai/analyze-form";
import { preprocessImage } from "@/lib/image/preprocess";
import { checkRateLimit } from "@/lib/rate-limit";
import { handleApiError } from "@/lib/api-error";
import { log } from "@/lib/logger";
import type { FormAnalysis } from "@/lib/ai/analyze-form";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const DOC_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];
const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/heic", "image/heif"];
const ALLOWED_TYPES = [...DOC_TYPES, ...IMAGE_TYPES];

export async function POST(req: NextRequest) {
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

    return NextResponse.json({ formId: form.id });
  } catch (err) {
    return handleApiError(err, "POST /api/forms/upload");
  }
}
