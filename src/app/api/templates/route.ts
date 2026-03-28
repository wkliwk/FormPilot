import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { handleApiError } from "@/lib/api-error";
import type { FormField } from "@/lib/ai/analyze-form";

// Sensitive fields to strip from templates
const SENSITIVE_KEYS = new Set([
  "ssn", "passportNumber", "driverLicense", "bankAccount", "routingNumber", "creditCard",
]);

// GET /api/templates — list user's templates
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const templates = await prisma.formTemplate.findMany({
      where: { userId: session.user.id },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        name: true,
        category: true,
        createdAt: true,
        updatedAt: true,
        fieldData: true,
      },
    });

    // Add field count to each template
    const result = templates.map((t) => {
      const fields = t.fieldData as Record<string, string>;
      return {
        ...t,
        fieldCount: Object.keys(fields).length,
      };
    });

    return NextResponse.json(result);
  } catch (err) {
    return handleApiError(err, "GET /api/templates");
  }
}

// POST /api/templates — save a form as a template
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { formId, name } = body;

  if (!formId || !name?.trim()) {
    return NextResponse.json(
      { error: "formId and name are required" },
      { status: 400 }
    );
  }

  try {
    // Fetch the form and verify ownership
    const form = await prisma.form.findUnique({ where: { id: formId } });
    if (!form || form.userId !== session.user.id) {
      return NextResponse.json({ error: "Form not found" }, { status: 404 });
    }

    const fields = form.fields as unknown as FormField[];
    const filledFields = fields.filter((f) => f.value);

    if (filledFields.length === 0) {
      return NextResponse.json(
        { error: "No filled fields to save as template" },
        { status: 400 }
      );
    }

    // Build field data map, stripping sensitive values
    const fieldData: Record<string, string> = {};
    for (const field of filledFields) {
      if (field.profileKey && SENSITIVE_KEYS.has(field.profileKey)) {
        continue; // Skip sensitive fields
      }
      fieldData[field.label] = field.value!;
    }

    const template = await prisma.formTemplate.create({
      data: {
        userId: session.user.id,
        name: name.trim(),
        sourceFormId: formId,
        fieldData,
        category: (form as Record<string, unknown>).category as string | null ?? null,
      },
    });

    return NextResponse.json({ id: template.id }, { status: 201 });
  } catch (err) {
    return handleApiError(err, "POST /api/templates");
  }
}
