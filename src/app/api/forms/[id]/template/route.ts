import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { handleApiError } from "@/lib/api-error";
import type { FormField } from "@/lib/ai/analyze-form";

// Sensitive profile keys to strip from templates (personal identifiable / financial data)
const SENSITIVE_PROFILE_KEYS = new Set([
  "ssn", "passportNumber", "driverLicense", "bankAccount", "routingNumber",
  "creditCard", "taxId", "ein",
]);

function generateSlug(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

function stripPersonalValues(fields: FormField[]): FormField[] {
  return fields.map((f) => {
    const stripped: FormField = {
      id: f.id,
      label: f.label,
      type: f.type,
      required: f.required,
      explanation: f.explanation,
      example: f.example,
      commonMistakes: f.commonMistakes,
      ...(f.whereToFind ? { whereToFind: f.whereToFind } : {}),
      ...(f.profileKey && !SENSITIVE_PROFILE_KEYS.has(f.profileKey) ? { profileKey: f.profileKey } : {}),
      ...(f.coordinates ? { coordinates: f.coordinates } : {}),
    };
    return stripped;
  });
}

// POST /api/forms/[id]/template — create a shareable template from a form
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const form = await prisma.form.findUnique({ where: { id } });
    if (!form || form.userId !== session.user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const fields = form.fields as unknown as FormField[];
    const sanitizedFields = stripPersonalValues(fields);

    // Generate a unique slug (retry on collision — extremely unlikely with 10 chars)
    let slug = generateSlug();
    let attempts = 0;
    while (attempts < 5) {
      const existing = await prisma.formTemplate.findUnique({ where: { slug } });
      if (!existing) break;
      slug = generateSlug();
      attempts++;
    }

    const template = await prisma.formTemplate.create({
      data: {
        userId: session.user.id,
        name: form.title,
        sourceFormId: id,
        fields: sanitizedFields as unknown as Parameters<typeof prisma.formTemplate.create>[0]["data"]["fields"],
        category: form.category,
        slug,
        visibility: "INVITE",
        usedCount: 0,
      },
    });

    return NextResponse.json({ slug: template.slug, templateId: template.id }, { status: 201 });
  } catch (err) {
    return handleApiError(err, "POST /api/forms/[id]/template");
  }
}
