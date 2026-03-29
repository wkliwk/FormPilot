import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { handleApiError } from "@/lib/api-error";
import { extractMemoryFromForm } from "@/lib/ai/extract-memory";
import type { FormField } from "@/lib/ai/analyze-form";

// POST /api/forms/[id]/extract-memory — extract filled values into FormMemory
// Called automatically when a form is marked COMPLETED
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const form = await prisma.form.findUnique({ where: { id } });
    if (!form || form.userId !== session.user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const fields = form.fields as unknown as FormField[];
    const upserted = await extractMemoryFromForm(
      session.user.id,
      form.id,
      form.title,
      fields
    );

    return NextResponse.json({ upserted });
  } catch (err) {
    return handleApiError(err, "POST /api/forms/[id]/extract-memory");
  }
}
