import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { extractTextFromBuffer } from "@/lib/pdf/extract";
import { analyzeFormFields } from "@/lib/ai/analyze-form";
import { checkRateLimit } from "@/lib/rate-limit";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimit = checkRateLimit(session.user.id);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      {
        status: 429,
        headers: { "Retry-After": String(rateLimit.retryAfter) },
      }
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

  const DOC_TYPES = [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ];
  const IMAGE_TYPES = [
    "image/png",
    "image/jpeg",
    "image/webp",
    "image/heic",
    "image/heif",
  ];
  const allowedTypes = [...DOC_TYPES, ...IMAGE_TYPES];

  if (!allowedTypes.includes(file.type)) {
    return NextResponse.json(
      { error: "Supported formats: PDF, DOCX, PNG, JPEG, WEBP, HEIC." },
      { status: 400 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const isImage = IMAGE_TYPES.includes(file.type);

  let analysis;
  let sourceType: "PDF" | "WORD" | "IMAGE";

  if (isImage) {
    // Image path: preprocess → vision analysis (wired in #47)
    const { preprocessImage } = await import("@/lib/image/preprocess");
    const processed = await preprocessImage(buffer, file.type);

    // TODO(#47): Replace with analyzeFormFieldsFromImage(processed.base64, processed.mimeType)
    // For now, return an error until the vision integration is complete
    return NextResponse.json(
      { error: "Image upload support is coming soon. Please upload a PDF or DOCX for now." },
      { status: 422 }
    );

    // Unreachable until #47 wires vision:
    // analysis = await analyzeFormFieldsFromImage(processed.base64, processed.mimeType);
    // sourceType = "IMAGE";
  } else {
    // Document path: extract text → analyze
    const text = await extractTextFromBuffer(buffer, file.type);

    if (!text || text.trim().length < 50) {
      return NextResponse.json(
        { error: "Could not extract readable text from this file. Is it a scanned image PDF?" },
        { status: 422 }
      );
    }

    analysis = await analyzeFormFields(text);
    sourceType =
      file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        ? "WORD"
        : "PDF";
  }

  const form = await prisma.form.create({
    data: {
      userId: session.user.id,
      title: analysis.title || file.name,
      sourceType,
      fileBytes: buffer,
      fields: analysis.fields as object,
      status: "ANALYZED",
    },
  });

  return NextResponse.json({ formId: form.id });
}
