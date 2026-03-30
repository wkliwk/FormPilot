import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Cache the count for 60 seconds to avoid hammering DB on launch day
let cached: { count: number; ts: number } | null = null;
const TTL_MS = 60_000;

export async function GET() {
  const now = Date.now();
  if (cached && now - cached.ts < TTL_MS) {
    return NextResponse.json({ formsProcessed: cached.count });
  }

  const count = await prisma.form.count();
  cached = { count, ts: now };

  return NextResponse.json(
    { formsProcessed: count },
    { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" } }
  );
}
