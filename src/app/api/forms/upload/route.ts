import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { extractTextFromBuffer } from "@/lib/pdf/extract";
import { analyzeFormFields } from "@/lib/ai/analyze-form";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "File too large. Max 10MB." }, { status: 400 });
  }

  const allowedTypes = [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ];
  if (!allowedTypes.includes(file.type)) {
    return NextResponse.json({ error: "Only PDF and DOCX files are supported." }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const text = await extractTextFromBuffer(buffer, file.type);

  if (!text || text.trim().length < 50) {
    return NextResponse.json(
      { error: "Could not extract readable text from this file. Is it a scanned image PDF?" },
      { status: 422 }
    );
  }

  const analysis = await analyzeFormFields(text);

  const sourceType =
    file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      ? "WORD"
      : "PDF";

  const form = await prisma.form.create({
    data: {
      userId: session.user.id,
      title: analysis.title || file.name,
      sourceType,
      fields: analysis.fields as object,
      status: "ANALYZED",
    },
  });

  return NextResponse.json({ formId: form.id });
}
