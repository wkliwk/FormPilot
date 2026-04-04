import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { handleApiError } from "@/lib/api-error";

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
    const form = await prisma.form.findUnique({
      where: { id },
      select: { userId: true },
    });

    if (!form || form.userId !== session.user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const snapshots = await prisma.formSnapshot.findMany({
      where: { formId: id },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { id: true, createdAt: true },
    });

    return NextResponse.json({ snapshots });
  } catch (err) {
    return handleApiError(err, "GET /api/forms/[id]/snapshots");
  }
}
