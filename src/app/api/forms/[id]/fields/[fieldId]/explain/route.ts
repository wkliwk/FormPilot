import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isProUser } from "@/lib/subscription";
import type { FormField } from "@/lib/ai/analyze-form";

// Separate in-memory rate limiter for explain calls (lighter than the general AI limiter)
const explainStore = new Map<string, { timestamps: number[] }>();
const FREE_EXPLAIN_LIMIT = 15; // per hour
const PRO_EXPLAIN_LIMIT = 30; // per hour
const EXPLAIN_WINDOW_MS = 60 * 60_000; // 1 hour

function checkExplainLimit(userId: string, limit: number): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const cutoff = now - EXPLAIN_WINDOW_MS;
  let entry = explainStore.get(userId);
  if (!entry) {
    entry = { timestamps: [] };
    explainStore.set(userId, entry);
  }
  entry.timestamps = entry.timestamps.filter((t) => t > cutoff);
  if (entry.timestamps.length >= limit) {
    return { allowed: false, remaining: 0 };
  }
  entry.timestamps.push(now);
  return { allowed: true, remaining: limit - entry.timestamps.length };
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; fieldId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, fieldId } = await params;

  const form = await prisma.form.findUnique({ where: { id } });
  if (!form || form.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const isPro = await isProUser(session.user.id);
  const limit = isPro ? PRO_EXPLAIN_LIMIT : FREE_EXPLAIN_LIMIT;
  const { allowed, remaining } = checkExplainLimit(session.user.id, limit);

  if (!allowed) {
    return NextResponse.json(
      {
        error: "rate_limited",
        message: isPro
          ? "You've reached 30 field help calls per hour."
          : "You've reached 15 field help calls per hour on the free plan.",
        isPro,
      },
      { status: 429 }
    );
  }

  const fields = form.fields as unknown as FormField[];
  const field = fields.find((f) => f.id === fieldId);
  if (!field) {
    return NextResponse.json({ error: "Field not found" }, { status: 404 });
  }

  return NextResponse.json({
    explanation: field.explanation ?? "",
    example: field.example ?? "",
    commonMistakes: field.commonMistakes ?? null,
    whereToFind: field.whereToFind ?? null,
    isPro,
    remaining,
  });
}
