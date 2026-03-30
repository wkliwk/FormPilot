import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { normalizeLabel } from "@/lib/ai/suggestion-engine";

const bodySchema = z.object({
  fieldLabel: z.string().min(1).max(200),
  value: z.string().min(1).max(2000),
});

// GET /api/corrections — list all saved corrections for the current user
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const corrections = await prisma.formMemory.findMany({
    where: { userId: session.user.id, fieldType: "correction" },
    orderBy: { lastUsed: "desc" },
    select: { id: true, label: true, value: true, lastUsed: true },
  });

  return NextResponse.json({ corrections });
}

// POST /api/corrections — save or update a correction
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "fieldLabel and value are required" }, { status: 400 });
  }

  const { fieldLabel, value } = parsed.data;
  const normalizedLabel = normalizeLabel(fieldLabel);

  if (!normalizedLabel) {
    return NextResponse.json({ error: "Invalid field label" }, { status: 400 });
  }

  // Upsert into FormMemory — corrections override auto-extracted memory for the same label
  const correction = await prisma.formMemory.upsert({
    where: { userId_label: { userId: session.user.id, label: normalizedLabel } },
    create: {
      userId: session.user.id,
      fieldType: "correction",
      label: normalizedLabel,
      value,
      confidence: 1.0,
      sourceFormId: "manual",
      sourceTitle: "Manual correction",
      lastUsed: new Date(),
    },
    update: {
      value,
      fieldType: "correction",
      confidence: 1.0,
      lastUsed: new Date(),
    },
    select: { id: true, label: true, value: true },
  });

  return NextResponse.json({ correction });
}
