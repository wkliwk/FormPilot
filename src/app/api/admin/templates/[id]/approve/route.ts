import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdminUser } from "@/lib/subscription";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!(await isAdminUser(session.user.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const template = await prisma.formTemplate.findUnique({
    where: { id },
    select: { id: true, visibility: true },
  });

  if (!template) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (template.visibility !== "PUBLIC_PENDING") {
    return NextResponse.json({ error: "Template is not pending approval" }, { status: 400 });
  }

  await prisma.formTemplate.update({
    where: { id },
    data: { visibility: "PUBLIC" },
  });

  return NextResponse.json({ ok: true });
}
