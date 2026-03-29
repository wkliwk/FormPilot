import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { handleApiError } from "@/lib/api-error";
import type { FormField } from "@/lib/ai/analyze-form";

/** Normalize a label for fuzzy matching */
function normalizeLabel(label: string): string {
  return label.toLowerCase().trim().replace(/[^a-z0-9]/g, "");
}

// POST /api/forms/[id]/apply-template — apply template values to a form
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const { templateId } = body;

  if (!templateId) {
    return NextResponse.json({ error: "templateId is required" }, { status: 400 });
  }

  try {
    // Fetch form and template, verify ownership
    const [form, template] = await Promise.all([
      prisma.form.findUnique({ where: { id } }),
      prisma.formTemplate.findUnique({ where: { id: templateId } }),
    ]);

    if (!form || form.userId !== session.user.id) {
      return NextResponse.json({ error: "Form not found" }, { status: 404 });
    }
    if (!template || template.userId !== session.user.id) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    const fields = form.fields as unknown as FormField[];
    // Support both old fieldData (Record<string,string>) and new fields (FormField[]) format
    const rawTemplateData = template.fields as unknown;
    const templateData: Record<string, string> = Array.isArray(rawTemplateData)
      ? Object.fromEntries((rawTemplateData as FormField[]).filter((f) => f.value).map((f) => [f.label, f.value!]))
      : (rawTemplateData as Record<string, string>);

    // Build a normalized label → value map from template
    const templateMap = new Map<string, string>();
    for (const [label, value] of Object.entries(templateData)) {
      templateMap.set(normalizeLabel(label), value);
    }

    // Apply template values to matching fields
    let applied = 0;
    const updatedFields = fields.map((field) => {
      const normalizedLabel = normalizeLabel(field.label);
      const templateValue = templateMap.get(normalizedLabel);

      if (templateValue && !field.value) {
        applied++;
        return {
          ...field,
          value: templateValue,
          confidence: 0.7, // Template match confidence
          fieldState: "pending" as const,
        };
      }
      return field;
    });

    // Save updated fields
    await prisma.form.update({
      where: { id },
      data: {
        fields: updatedFields as object,
        status: "FILLING",
      },
    });

    return NextResponse.json({
      applied,
      total: fields.length,
      fields: updatedFields,
    });
  } catch (err) {
    return handleApiError(err, "POST /api/forms/[id]/apply-template");
  }
}
