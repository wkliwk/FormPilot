import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { handleApiError } from "@/lib/api-error";
import { canUploadForm, incrementFormUsage } from "@/lib/subscription";
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

    // Quota check — refill counts as a new form
    const quota = await canUploadForm(session.user.id);
    if (!quota.allowed) {
      return NextResponse.json(
        { error: "Form limit reached", formsUsed: quota.formsUsed, limit: quota.limit },
        { status: 403 }
      );
    }

    // Unlike duplicate, refill preserves field values as a starting point.
    // We only reset fieldState so the user reviews each field fresh.
    const preservedFields = (original.fields as unknown as FormField[]).map((f) => ({
      ...f,
      fieldState: "pending",
    }));

    const copy = await prisma.form.create({
      data: {
        userId: session.user.id,
        title: `${original.title} (re-fill)`,
        sourceType: original.sourceType,
        sourceUrl: original.sourceUrl,
        fileKey: original.fileKey,
        fileBytes: original.fileBytes,
        fields: preservedFields as object[],
        filledData: original.filledData ?? {},
        language: original.language,
        status: "FILLING",
        category: original.category,
      },
    });

    await incrementFormUsage(session.user.id);

    return NextResponse.json({ id: copy.id }, { status: 201 });
  } catch (err) {
    return handleApiError(err, "POST /api/forms/[id]/refill");
  }
}
