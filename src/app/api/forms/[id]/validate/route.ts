import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { validateForm } from "@/lib/validation/validate-form";
import { handleApiError } from "@/lib/api-error";
import type { FormField } from "@/lib/ai/analyze-form";

export async function GET(
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

    // Build values and states maps from current field data
    const values: Record<string, string> = {};
    const fieldStates: Record<string, string> = {};
    for (const field of fields) {
      if (field.value) values[field.id] = field.value;
      if (field.fieldState) fieldStates[field.id] = field.fieldState;
    }

    const result = validateForm(fields, values, fieldStates);

    return NextResponse.json(result);
  } catch (err) {
    return handleApiError(err, "GET /api/forms/[id]/validate");
  }
}
