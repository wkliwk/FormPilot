import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { digestUnsubscribed: true, reminderEmailsEnabled: true },
  });

  return NextResponse.json({
    digestEnabled: !user?.digestUnsubscribed,
    reminderEmailsEnabled: user?.reminderEmailsEnabled ?? true,
  });
}

const patchSchema = z.object({
  digestEnabled: z.boolean().optional(),
  reminderEmailsEnabled: z.boolean().optional(),
});

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const updateData: Record<string, unknown> = {};
  if (parsed.data.digestEnabled !== undefined) {
    updateData.digestUnsubscribed = !parsed.data.digestEnabled;
  }
  if (parsed.data.reminderEmailsEnabled !== undefined) {
    updateData.reminderEmailsEnabled = parsed.data.reminderEmailsEnabled;
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ ok: true });
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: updateData,
  });

  return NextResponse.json({ ok: true });
}
