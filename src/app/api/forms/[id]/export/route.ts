import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { FormField } from "@/lib/ai/analyze-form";

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
  const filledFields = fields.filter((f) => f.value);

  if (filledFields.length === 0) {
    return NextResponse.json({ error: "No filled fields to export" }, { status: 400 });
  }

  // If we have a stored file, try to fill it — otherwise return JSON export
  // (File storage is a future feature; for now always return structured JSON)
  const exportData = {
    title: form.title,
    exportedAt: new Date().toISOString(),
    fields: filledFields.map((f) => ({
      label: f.label,
      value: f.value,
    })),
  };

  const json = JSON.stringify(exportData, null, 2);

  return new NextResponse(json, {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${form.title.replace(/[^a-z0-9]/gi, "_")}_filled.json"`,
    },
  });
}
