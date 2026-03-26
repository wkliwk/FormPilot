import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const form = await prisma.form.findUnique({ where: { id } });

  if (!form || form.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ form });
}

const updateSchema = z.object({
  fields: z.array(z.object({
    id: z.string(),
    value: z.string().optional(),
  })).optional(),
  status: z.enum(["PENDING", "ANALYZED", "FILLING", "COMPLETED"]).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const form = await prisma.form.findUnique({ where: { id } });

  if (!form || form.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid data" }, { status: 400 });
  }

  const updateData: Record<string, unknown> = {};

  if (parsed.data.status) {
    updateData.status = parsed.data.status;
  }

  if (parsed.data.fields) {
    // Merge new values into existing fields
    const existingFields = form.fields as Array<Record<string, unknown>>;
    const updates = new Map(parsed.data.fields.map((f) => [f.id, f.value]));

    const mergedFields = existingFields.map((f) => {
      const newValue = updates.get(f.id as string);
      if (newValue !== undefined) {
        return { ...f, value: newValue };
      }
      return f;
    });

    updateData.fields = mergedFields;
    updateData.filledData = Object.fromEntries(
      mergedFields
        .filter((f) => f.value)
        .map((f) => [f.id, f.value])
    );
  }

  const updated = await prisma.form.update({
    where: { id },
    data: updateData,
  });

  return NextResponse.json({ form: updated });
}
