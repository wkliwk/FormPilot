import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { handleApiError } from "@/lib/api-error";
import { z } from "zod";

const NOTE_MAX_LENGTH = 280;

const patchSchema = z.object({
  fieldId: z.string().min(1),
  note: z.string().max(NOTE_MAX_LENGTH).nullable(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const form = await prisma.form.findUnique({ where: { id } });

    if (!form) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (form.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const parsed = patchSchema.safeParse(body);

    if (!parsed.success) {
      const noteError = parsed.error.issues.find((i) => i.path[0] === "note");
      if (noteError?.code === "too_big") {
        return NextResponse.json(
          { error: `Note must be ${NOTE_MAX_LENGTH} characters or fewer` },
          { status: 400 }
        );
      }
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const { fieldId, note } = parsed.data;

    // Merge into filledData.fieldNotes — preserve all other filledData keys
    const existingFilledData =
      form.filledData && typeof form.filledData === "object" && !Array.isArray(form.filledData)
        ? (form.filledData as Record<string, unknown>)
        : {};

    const existingNotes =
      existingFilledData.fieldNotes &&
      typeof existingFilledData.fieldNotes === "object" &&
      !Array.isArray(existingFilledData.fieldNotes)
        ? (existingFilledData.fieldNotes as Record<string, string>)
        : {};

    let updatedNotes: Record<string, string>;
    if (note === null) {
      // Remove the key
      const { [fieldId]: _removed, ...rest } = existingNotes;
      updatedNotes = rest;
    } else {
      updatedNotes = { ...existingNotes, [fieldId]: note };
    }

    const updatedFilledData = {
      ...existingFilledData,
      fieldNotes: updatedNotes,
    };

    await prisma.form.update({
      where: { id },
      data: { filledData: updatedFilledData },
    });

    return NextResponse.json({ fieldNotes: updatedNotes });
  } catch (err) {
    return handleApiError(err, "PATCH /api/forms/[id]/notes");
  }
}
