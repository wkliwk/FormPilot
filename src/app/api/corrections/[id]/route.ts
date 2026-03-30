import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const record = await prisma.formMemory.findUnique({ where: { id } });
  if (!record || record.userId !== session.user.id || record.fieldType !== "correction") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.formMemory.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
