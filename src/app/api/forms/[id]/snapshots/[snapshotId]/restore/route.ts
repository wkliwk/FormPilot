import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { handleApiError } from "@/lib/api-error";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; snapshotId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, snapshotId } = await params;

  try {
    const form = await prisma.form.findUnique({
      where: { id },
      select: { userId: true },
    });

    if (!form || form.userId !== session.user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const snapshot = await prisma.formSnapshot.findUnique({
      where: { id: snapshotId },
    });

    if (!snapshot || snapshot.formId !== id) {
      return NextResponse.json({ error: "Snapshot not found" }, { status: 404 });
    }

    const fields = snapshot.fields as Array<Record<string, unknown>>;

    const updated = await prisma.form.update({
      where: { id },
      data: {
        fields: fields as object,
        filledData: Object.fromEntries(
          fields.filter((f) => f.value).map((f) => [f.id, f.value])
        ),
        status: "FILLING",
        version: { increment: 1 },
      },
    });

    return NextResponse.json({ form: updated });
  } catch (err) {
    return handleApiError(err, "POST /api/forms/[id]/snapshots/[snapshotId]/restore");
  }
}
