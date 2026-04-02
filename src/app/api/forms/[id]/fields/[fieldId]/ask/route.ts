import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { callTextAI } from "@/lib/ai/provider-chain";
import { handleApiError } from "@/lib/api-error";
import { z } from "zod";
import type { FormField } from "@/lib/ai/analyze-form";

export const maxDuration = 30;

// Rate limit: 10 questions per form per hour per user (in-memory sliding window)
const ASK_WINDOW_MS = 60 * 60_000;
const ASK_LIMIT = 10;
const askStore = new Map<string, { timestamps: number[] }>();

function checkAskRateLimit(key: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const cutoff = now - ASK_WINDOW_MS;
  let entry = askStore.get(key);
  if (!entry) { entry = { timestamps: [] }; askStore.set(key, entry); }
  entry.timestamps = entry.timestamps.filter((t) => t > cutoff);
  if (entry.timestamps.length >= ASK_LIMIT) {
    const retryAfter = Math.ceil((entry.timestamps[0] + ASK_WINDOW_MS - now) / 1000);
    return { allowed: false, retryAfter: retryAfter > 0 ? retryAfter : 1 };
  }
  entry.timestamps.push(now);
  return { allowed: true };
}

const bodySchema = z.object({
  question: z.string().min(1).max(500),
});

export async function POST(
  req: NextRequest,
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

  // Per-user per-form rate limit
  const rlKey = `${session.user.id}:${id}`;
  const rl = checkAskRateLimit(rlKey);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "rate_limited", retryAfter: rl.retryAfter },
      { status: 429 }
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { question } = parsed.data;

  const fields = form.fields as unknown as FormField[];
  const field = fields.find((f) => f.id === fieldId);
  if (!field) {
    return NextResponse.json({ error: "Field not found" }, { status: 404 });
  }

  const currentValue = field.value ? `The user's current answer for this field is: "${field.value}".` : "";

  const prompt = `You are a form-filling assistant. A user is filling out a form and has a question about a specific field.

Field: "${field.label}"
Field type: ${field.type}
${field.explanation ? `Field explanation: ${field.explanation}` : ""}
${field.example ? `Example answer: ${field.example}` : ""}
${currentValue}

User's question: ${question}

Answer the question concisely and specifically. Focus on what they need to know to fill in this field correctly. Keep your answer to 2-4 sentences maximum. Do not repeat information already in the explanation unless directly relevant.`;

  try {
    const answer = await callTextAI(prompt, "field-ask", 512);
    if (!answer) {
      return NextResponse.json({ error: "No answer generated" }, { status: 500 });
    }
    return NextResponse.json({ answer });
  } catch (err) {
    return handleApiError(err, `POST /api/forms/${id}/fields/${fieldId}/ask`);
  }
}
