import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isProUser } from "@/lib/subscription";
import { handleApiError } from "@/lib/api-error";
import { z } from "zod";
import { nanoid } from "nanoid";

const EXPIRY_DAYS: Record<string, number> = { "1d": 1, "7d": 7, "30d": 30 };

const createSchema = z.object({
  lockedFieldIds: z.array(z.string()).min(1),
  recipientEmail: z.string().email().optional(),
  expiresIn: z.enum(["1d", "7d", "30d"]).default("7d"),
});

// POST /api/forms/[id]/share-packet — create a new share packet (Pro only)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isPro = await isProUser(session.user.id);
  if (!isPro) {
    return NextResponse.json({ error: "Pro subscription required" }, { status: 403 });
  }

  const { id: formId } = await params;

  try {
    const form = await prisma.form.findUnique({
      where: { id: formId },
      select: { userId: true },
    });

    if (!form || form.userId !== session.user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = await req.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    const days = EXPIRY_DAYS[parsed.data.expiresIn] ?? 7;
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

    const packet = await prisma.formSharePacket.create({
      data: {
        formId,
        token: nanoid(21),
        lockedFieldIds: parsed.data.lockedFieldIds,
        recipientEmail: parsed.data.recipientEmail ?? null,
        expiresAt,
      },
    });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://getformpilot.com";

    return NextResponse.json({
      id: packet.id,
      token: packet.token,
      url: `${appUrl}/share/fill/${packet.token}`,
      expiresAt: packet.expiresAt.toISOString(),
    }, { status: 201 });
  } catch (err) {
    return handleApiError(err, "POST /api/forms/[id]/share-packet");
  }
}

// GET /api/forms/[id]/share-packet — list active share packets
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: formId } = await params;

  try {
    const form = await prisma.form.findUnique({
      where: { id: formId },
      select: { userId: true },
    });

    if (!form || form.userId !== session.user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const packets = await prisma.formSharePacket.findMany({
      where: { formId, revokedAt: null },
      select: {
        id: true,
        token: true,
        recipientEmail: true,
        expiresAt: true,
        completedAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ packets });
  } catch (err) {
    return handleApiError(err, "GET /api/forms/[id]/share-packet");
  }
}
