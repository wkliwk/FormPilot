import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Cache the count for 60 seconds to avoid hammering DB on launch day
let cached: { count: number; filledRounded: number; ts: number } | null = null;
const TTL_MS = 60_000;

export async function GET() {
  const now = Date.now();
  if (cached && now - cached.ts < TTL_MS) {
    return NextResponse.json({ formsProcessed: cached.count, formsFilledRounded: cached.filledRounded });
  }

  const [count, filledCount] = await Promise.all([
    prisma.form.count(),
    prisma.form.count({ where: { status: "COMPLETED" } }),
  ]);
  // Round down to nearest 50 for a conservative public-facing number
  const filledRounded = Math.floor(filledCount / 50) * 50;
  cached = { count, filledRounded, ts: now };

  return NextResponse.json(
    { formsProcessed: count, formsFilledRounded: filledRounded },
    { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" } }
  );
}
