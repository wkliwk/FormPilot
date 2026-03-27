import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { analyzeFormFields } from "@/lib/ai/analyze-form";
import { checkRateLimit } from "@/lib/rate-limit";
import type { FormField } from "@/lib/ai/analyze-form";

const SUPPORTED_LANGUAGES = ["en", "es", "zh", "ko", "vi", "tl", "ar", "hi", "fr", "pt"] as const;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

  const lang = req.nextUrl.searchParams.get("lang");

  if (!lang || !(SUPPORTED_LANGUAGES as readonly string[]).includes(lang)) {
    return NextResponse.json(
      { error: `Invalid or missing lang. Supported: ${SUPPORTED_LANGUAGES.join(", ")}` },
      { status: 400 }
    );
  }

  const { id } = await params;
  const form = await prisma.form.findUnique({ where: { id } });

  if (!form || form.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Re-analyze the form text in the requested language.
  // We reconstruct a minimal text representation from the stored fields so we
  // don't need to re-parse the original file. The labels and types are preserved.
  const existingFields = form.fields as unknown as FormField[];

  const fieldSummary = existingFields
    .map((f) => `Field: ${f.label} (${f.type})${f.required ? " [required]" : ""}`)
    .join("\n");

  const formText = `Form: ${form.title}\n\n${fieldSummary}`;

  const analysis = await analyzeFormFields(formText, lang);

  // Build a lookup map from the re-analyzed fields by label (normalized) so we
  // can update just explanation/example/commonMistakes while preserving every
  // other property (value, fieldState, confidence, profileKey, id, etc.).
  const explanationMap = new Map(
    analysis.fields.map((f) => [f.label.toLowerCase().trim(), f])
  );

  const updatedFields: FormField[] = existingFields.map((field) => {
    const hit = explanationMap.get(field.label.toLowerCase().trim());
    if (!hit) return field;
    return {
      ...field,
      explanation: hit.explanation,
      example: hit.example,
      commonMistakes: hit.commonMistakes,
    };
  });

  await prisma.form.update({
    where: { id },
    data: { fields: updatedFields as object },
  });

  return NextResponse.json({ fields: updatedFields, language: lang });
}
