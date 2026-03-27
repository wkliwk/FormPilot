import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSuggestionsFromHistory } from "@/lib/ai/suggestion-engine";
import type { FormField } from "@/lib/ai/analyze-form";

// GET /api/forms/[id]/suggestions — returns history-based suggestions for the form's fields
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

  const fields = form.fields as unknown as FormField[];

  const suggestions = await getSuggestionsFromHistory(session.user.id, fields);

  return NextResponse.json({ suggestions });
}
