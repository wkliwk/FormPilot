import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const patchSchema = z.object({
  enabled: z.boolean(),
});

// PATCH /api/webhooks/[id] — toggle enabled/disabled
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const webhook = await prisma.webhook.findUnique({ where: { id } });
  if (!webhook || webhook.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const updated = await prisma.webhook.update({
    where: { id },
    data: { enabled: parsed.data.enabled },
    select: { id: true, enabled: true },
  });

  return NextResponse.json(updated);
}

// DELETE /api/webhooks/[id] — delete a webhook
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const webhook = await prisma.webhook.findUnique({ where: { id } });
  if (!webhook || webhook.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.webhook.delete({ where: { id } });

  return NextResponse.json({ deleted: true });
}
