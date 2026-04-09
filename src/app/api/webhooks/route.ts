import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isProUser } from "@/lib/subscription";
import { z } from "zod";
import crypto from "crypto";

const MAX_WEBHOOKS = 5;

const createSchema = z.object({
  url: z.string().url().max(500),
});

// GET /api/webhooks — list all webhooks for authenticated user
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const webhooks = await prisma.webhook.findMany({
    where: { userId: session.user.id },
    select: { id: true, url: true, secret: true, enabled: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  // Mask secret: show first 6 and last 4 chars
  const masked = webhooks.map((w) => ({
    ...w,
    secret: w.secret.slice(0, 6) + "..." + w.secret.slice(-4),
  }));

  return NextResponse.json({ webhooks: masked });
}

// POST /api/webhooks — create a new webhook (Pro only)
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isPro = await isProUser(session.user.id);
  if (!isPro) {
    return NextResponse.json({ error: "Pro subscription required" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  // Check limit
  const count = await prisma.webhook.count({ where: { userId: session.user.id } });
  if (count >= MAX_WEBHOOKS) {
    return NextResponse.json({ error: `Maximum ${MAX_WEBHOOKS} webhooks allowed` }, { status: 400 });
  }

  const secret = crypto.randomBytes(32).toString("hex");

  const webhook = await prisma.webhook.create({
    data: {
      userId: session.user.id,
      url: parsed.data.url,
      secret,
    },
    select: { id: true, url: true, secret: true, enabled: true, createdAt: true },
  });

  return NextResponse.json(webhook, { status: 201 });
}
