import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/forms/[id]/prior-form
 *
 * Returns the most recently completed form in the same category as form [id],
 * excluding [id] itself. Used to offer pre-filling suggestions to returning users.
 *
 * Response: { priorForm: { id, title, completedAt } | null }
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const targetForm = await prisma.form.findUnique({
    where: { id },
    select: { userId: true, category: true },
  });

  if (!targetForm || targetForm.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // No category set — nothing to match against
  if (!targetForm.category) {
    return NextResponse.json({ priorForm: null });
  }

  const prior = await prisma.form.findFirst({
    where: {
      userId: session.user.id,
      category: targetForm.category,
      status: "COMPLETED",
      id: { not: id },
    },
    orderBy: { updatedAt: "desc" },
    select: { id: true, title: true, updatedAt: true },
  });

  if (!prior) {
    return NextResponse.json({ priorForm: null });
  }

  return NextResponse.json({
    priorForm: {
      id: prior.id,
      title: prior.title,
      completedAt: prior.updatedAt.toISOString(),
    },
  });
}
