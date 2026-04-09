import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { handleApiError } from "@/lib/api-error";
import { z } from "zod";

const patchSchema = z.object({
  visibility: z.enum(["INVITE", "PUBLIC_PENDING"]).optional(),
  description: z.string().max(300).optional(),
});

// PATCH /api/templates/[id] — update template settings (e.g. submit to community)
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
    const template = await prisma.formTemplate.findUnique({ where: { id } });
    if (!template || template.userId !== session.user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = await req.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    const data: Record<string, unknown> = {};
    if (parsed.data.visibility !== undefined) {
      // Users can only set INVITE or PUBLIC_PENDING (not PUBLIC directly)
      data.visibility = parsed.data.visibility;
    }
    if (parsed.data.description !== undefined) {
      data.description = parsed.data.description;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ ok: true });
    }

    const updated = await prisma.formTemplate.update({
      where: { id },
      data,
      select: { id: true, visibility: true, description: true },
    });

    return NextResponse.json(updated);
  } catch (err) {
    return handleApiError(err, "PATCH /api/templates/[id]");
  }
}

// DELETE /api/templates/[id] — delete a template
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const template = await prisma.formTemplate.findUnique({ where: { id } });

    if (!template || template.userId !== session.user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await prisma.formTemplate.delete({ where: { id } });

    return NextResponse.json({ deleted: true });
  } catch (err) {
    return handleApiError(err, "DELETE /api/templates/[id]");
  }
}
