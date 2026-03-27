import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fillPDF } from "@/lib/pdf/fill";
import { validateForm } from "@/lib/validation/validate-form";
import type { FormField } from "@/lib/ai/analyze-form";

export async function GET(
  req: NextRequest,
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

  // Validation gate: block export if there are errors (unless ?force=true)
  const force = req.nextUrl.searchParams.get("force") === "true";
  if (!force) {
    const values: Record<string, string> = {};
    const fieldStates: Record<string, string> = {};
    for (const field of fields) {
      if (field.value) values[field.id] = field.value;
      if (field.fieldState) fieldStates[field.id] = field.fieldState;
    }
    const validation = validateForm(fields, values, fieldStates);
    if (!validation.valid) {
      return NextResponse.json(
        {
          error: "Validation failed",
          validation,
        },
        { status: 422 }
      );
    }
  }

  if (filledFields.length === 0) {
    return NextResponse.json({ error: "No filled fields to export" }, { status: 400 });
  }

  // PDF export: use stored file bytes to produce a filled PDF
  if (form.sourceType === "PDF" && form.fileBytes) {
    try {
      const originalBuffer = Buffer.from(form.fileBytes);
      const filledBuffer = await fillPDF(originalBuffer, fields);
      const safeTitle = form.title.replace(/[^a-z0-9]/gi, "_");

      return new NextResponse(new Uint8Array(filledBuffer), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${safeTitle}_filled.pdf"`,
        },
      });
    } catch (err) {
      console.error("[export] PDF fill failed, falling back to JSON:", err);
      // Fall through to JSON export on error
    }
  }

  // Fallback: JSON export (DOCX, WEB, SPREADSHEET sources, or if PDF fill fails)
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
