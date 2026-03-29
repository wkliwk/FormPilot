import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { handleApiError } from "@/lib/api-error";

// GET /api/t/[slug] — public template fetch (no auth required, increments usedCount on first hit per session)
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  try {
    const template = await prisma.formTemplate.findUnique({ where: { slug } });

    if (!template || template.revokedAt) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    // Increment usedCount
    await prisma.formTemplate.update({
      where: { id: template.id },
      data: { usedCount: { increment: 1 } },
    });

    return NextResponse.json({
      id: template.id,
      name: template.name,
      category: template.category,
      fields: template.fields,
      visibility: template.visibility,
      createdAt: template.createdAt,
    });
  } catch (err) {
    return handleApiError(err, "GET /api/t/[slug]");
  }
}

// DELETE /api/t/[slug] — revoke template (owner only)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { slug } = await params;

  try {
    const template = await prisma.formTemplate.findUnique({ where: { slug } });

    if (!template || template.userId !== session.user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await prisma.formTemplate.update({
      where: { id: template.id },
      data: { revokedAt: new Date() },
    });

    return NextResponse.json({ revoked: true });
  } catch (err) {
    return handleApiError(err, "DELETE /api/t/[slug]");
  }
}
