import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { handleApiError } from "@/lib/api-error";
import type { FormField } from "@/lib/ai/analyze-form";

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
    const original = await prisma.form.findUnique({ where: { id } });

    if (!original) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (original.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Deep-clone fields, stripping all filled values and state
    const cleanedFields = (original.fields as unknown as FormField[]).map((f) => ({
      ...f,
      value: undefined,
      filledData: undefined,
      fieldState: undefined,
    }));

    const copy = await prisma.form.create({
      data: {
        userId: session.user.id,
        title: `${original.title} (copy)`,
        sourceType: original.sourceType,
        sourceUrl: original.sourceUrl,
        fileKey: original.fileKey,
        fileBytes: original.fileBytes,
        fields: cleanedFields as object[],
        filledData: {},
        language: original.language,
        status: "ANALYZED",
        category: original.category,
      },
    });

    return NextResponse.json({ id: copy.id }, { status: 201 });
  } catch (err) {
    return handleApiError(err, "POST /api/forms/[id]/duplicate");
  }
}
