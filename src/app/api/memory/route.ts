import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { handleApiError } from "@/lib/api-error";

// GET /api/memory — list user's form memory entries
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const records = await prisma.formMemory.findMany({
      where: { userId: session.user.id },
      orderBy: { lastUsed: "desc" },
      select: {
        id: true,
        fieldType: true,
        label: true,
        value: true,
        confidence: true,
        sourceTitle: true,
        lastUsed: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ records });
  } catch (err) {
    return handleApiError(err, "GET /api/memory");
  }
}

// DELETE /api/memory — delete all memory for the user
export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { count } = await prisma.formMemory.deleteMany({
      where: { userId: session.user.id },
    });
    return NextResponse.json({ deleted: count });
  } catch (err) {
    return handleApiError(err, "DELETE /api/memory");
  }
}
