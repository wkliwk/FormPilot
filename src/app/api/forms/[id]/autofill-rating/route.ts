import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: formId } = await params;

  // Verify the form belongs to this user
  const form = await prisma.form.findUnique({
    where: { id: formId },
    select: { userId: true },
  });

  if (!form || form.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json();
  const score = body.score;

  if (typeof score !== "number" || !Number.isInteger(score) || score < 1 || score > 5) {
    return NextResponse.json({ error: "Score must be an integer between 1 and 5" }, { status: 400 });
  }

  const rating = await prisma.autofillRating.upsert({
    where: {
      formId_userId: { formId, userId: session.user.id },
    },
    update: { score },
    create: { formId, userId: session.user.id, score },
  });

  return NextResponse.json({ id: rating.id, score: rating.score });
}
