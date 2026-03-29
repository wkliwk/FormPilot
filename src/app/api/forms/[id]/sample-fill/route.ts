import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { FormField } from "@/lib/ai/analyze-form";
import { generateSampleValue } from "@/lib/sample-data";

export async function POST(
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
  const values: Record<string, string> = {};

  for (const field of fields) {
    values[field.id] = generateSampleValue(field);
  }

  return NextResponse.json({ values });
}
