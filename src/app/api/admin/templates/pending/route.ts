import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdminUser } from "@/lib/subscription";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!(await isAdminUser(session.user.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const templates = await prisma.formTemplate.findMany({
    where: { visibility: "PUBLIC_PENDING", revokedAt: null },
    select: {
      id: true,
      name: true,
      category: true,
      description: true,
      slug: true,
      fields: true,
      createdAt: true,
      user: { select: { email: true, name: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({
    templates: templates.map((t) => ({
      ...t,
      fieldCount: Array.isArray(t.fields) ? (t.fields as unknown[]).length : 0,
      fields: undefined,
    })),
  });
}
