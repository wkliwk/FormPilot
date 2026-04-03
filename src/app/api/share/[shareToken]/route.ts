import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { FormField } from "@/lib/ai/analyze-form";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ shareToken: string }> }
) {
  const { shareToken } = await params;

  const form = await prisma.form.findUnique({
    where: { shareToken },
    select: {
      title: true,
      fields: true,
      category: true,
    },
  });

  if (!form) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const fields = (form.fields as unknown as FormField[]).map((f) => ({
    id: f.id,
    label: f.label,
    type: f.type,
    required: f.required,
    explanation: f.explanation,
    example: f.example,
    commonMistakes: f.commonMistakes,
    whereToFind: f.whereToFind,
    // Explicitly omit: value, confidence, fieldState (user PII)
  }));

  return NextResponse.json({
    title: form.title,
    category: form.category,
    fields,
  });
}
