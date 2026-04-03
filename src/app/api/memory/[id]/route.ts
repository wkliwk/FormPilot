import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { handleApiError } from "@/lib/api-error";

// DELETE /api/memory/[id] — delete a single memory record
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
    const record = await prisma.formMemory.findUnique({ where: { id } });
    if (!record || record.userId !== session.user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await prisma.formMemory.delete({ where: { id } });
    return NextResponse.json({ deleted: true });
  } catch (err) {
    return handleApiError(err, "DELETE /api/memory/[id]");
  }
}

const patchSchema = z.object({
  value: z.string().min(1, "Value cannot be empty").max(500, "Value must be 500 characters or fewer"),
});

// PATCH /api/memory/[id] — update a memory record value (user correction)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "Invalid request" },
      { status: 400 }
    );
  }

  try {
    const record = await prisma.formMemory.findUnique({ where: { id } });
    if (!record || record.userId !== session.user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const updated = await prisma.formMemory.update({
      where: { id },
      data: {
        value: parsed.data.value,
        confidence: 1.0,
        lastUsed: new Date(),
      },
    });

    return NextResponse.json(updated);
  } catch (err) {
    return handleApiError(err, "PATCH /api/memory/[id]");
  }
}
