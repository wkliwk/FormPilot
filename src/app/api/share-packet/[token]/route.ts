import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleApiError } from "@/lib/api-error";
import { z } from "zod";
import type { FormField } from "@/lib/ai/analyze-form";

// GET /api/share-packet/[token] — fetch the form data for a share packet (no auth)
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  try {
    const packet = await prisma.formSharePacket.findUnique({
      where: { token },
    });

    if (!packet) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (packet.revokedAt) {
      return NextResponse.json({ error: "This link has been revoked." }, { status: 410 });
    }

    if (packet.expiresAt < new Date()) {
      return NextResponse.json({ error: "This link has expired." }, { status: 410 });
    }

    if (packet.completedAt) {
      return NextResponse.json({ error: "This form has already been submitted." }, { status: 410 });
    }

    const form = await prisma.form.findUnique({
      where: { id: packet.formId },
      select: { title: true, fields: true, category: true },
    });

    if (!form) {
      return NextResponse.json({ error: "Form not found" }, { status: 404 });
    }

    const lockedIds = new Set(packet.lockedFieldIds as string[]);
    const fields = (form.fields as unknown as FormField[]).map((f) => ({
      id: f.id,
      label: f.label,
      type: f.type,
      value: f.value ?? "",
      required: f.required,
      explanation: f.explanation,
      example: f.example,
      locked: lockedIds.has(f.id),
    }));

    return NextResponse.json({
      title: form.title,
      category: form.category,
      fields,
      expiresAt: packet.expiresAt.toISOString(),
    });
  } catch (err) {
    return handleApiError(err, "GET /api/share-packet/[token]");
  }
}

const submitSchema = z.object({
  values: z.record(z.string()),
});

// PATCH /api/share-packet/[token] — recipient submits filled fields
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  try {
    const packet = await prisma.formSharePacket.findUnique({
      where: { token },
    });

    if (!packet || packet.revokedAt || packet.completedAt) {
      return NextResponse.json({ error: "Invalid or expired link" }, { status: 410 });
    }

    if (packet.expiresAt < new Date()) {
      return NextResponse.json({ error: "This link has expired." }, { status: 410 });
    }

    const body = await req.json();
    const parsed = submitSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    const lockedIds = new Set(packet.lockedFieldIds as string[]);
    const recipientValues = parsed.data.values;

    // Merge recipient values into the form's fields (only for non-locked fields)
    const form = await prisma.form.findUnique({
      where: { id: packet.formId },
      select: { fields: true, filledData: true },
    });

    if (!form) {
      return NextResponse.json({ error: "Form not found" }, { status: 404 });
    }

    const fields = form.fields as unknown as FormField[];
    const updatedFields = fields.map((f) => {
      if (!lockedIds.has(f.id) && recipientValues[f.id] !== undefined) {
        return { ...f, value: recipientValues[f.id] };
      }
      return f;
    });

    // Update form + mark packet as completed
    await prisma.$transaction([
      prisma.form.update({
        where: { id: packet.formId },
        data: { fields: JSON.parse(JSON.stringify(updatedFields)) },
      }),
      prisma.formSharePacket.update({
        where: { token },
        data: { completedAt: new Date() },
      }),
    ]);

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err, "PATCH /api/share-packet/[token]");
  }
}
