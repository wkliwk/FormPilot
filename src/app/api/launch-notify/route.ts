import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const RATE_LIMIT_MAX = 3;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

const schema = z.object({
  email: z.string().email("Please enter a valid email address"),
  source: z.enum(["landing", "demo", "dashboard"]).default("landing"),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "Invalid email" },
      { status: 400 }
    );
  }

  const { email, source } = parsed.data;

  // Rate limit by IP — 3 per hour
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";
  const key = `ip:${ip}:launch_notify`;
  const now = new Date();
  const windowStart = new Date(now.getTime() - RATE_LIMIT_WINDOW_MS);

  const rl = await prisma.rateLimit.upsert({
    where: { key },
    update: {
      count: { increment: 1 },
      windowStart: { set: windowStart },
      updatedAt: now,
    },
    create: {
      key,
      count: 1,
      windowStart: now,
    },
  });

  // If windowStart of the stored record is older than the window, this is a fresh window
  const inWindow = rl.windowStart >= windowStart;
  if (inWindow && rl.count > RATE_LIMIT_MAX) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 }
    );
  }

  await prisma.launchNotify.upsert({
    where: { email },
    update: { source },
    create: { email, source },
  });

  return NextResponse.json({ ok: true });
}
