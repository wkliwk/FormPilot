import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { handleApiError } from "@/lib/api-error";
import { extractMemoryFromForm } from "@/lib/ai/extract-memory";
import { sendEmail } from "@/lib/email";
import FormCompletedEmail from "@/emails/FormCompletedEmail";
import type { FormField } from "@/lib/ai/analyze-form";
import { z } from "zod";
import * as React from "react";
import { resetMonthlyUsage, getOrCreateUsage } from "@/lib/subscription";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://getformpilot.com";

export async function GET(
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

    return NextResponse.json({ form });
  } catch (err) {
    return handleApiError(err, "GET /api/forms/[id]");
  }
}

export async function DELETE(
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

    if (!form) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (form.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Revoke any templates created from this form so shared links show a graceful page
    await prisma.formTemplate.updateMany({
      where: { sourceFormId: id, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    await prisma.form.delete({ where: { id } });

    // Decrement monthly usage so the user gets their slot back
    const usage = await getOrCreateUsage(session.user.id);
    if (usage.formsThisMonth > 0) {
      await prisma.usageCount.update({
        where: { userId: session.user.id },
        data: { formsThisMonth: { decrement: 1 }, updatedAt: new Date() },
      });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    return handleApiError(err, "DELETE /api/forms/[id]");
  }
}

const updateSchema = z.object({
  fields: z
    .array(
      z.object({
        id: z.string(),
        value: z.string().optional(),
        fieldState: z.enum(["pending", "accepted", "rejected"]).optional(),
      })
    )
    .optional(),
  status: z.enum(["PENDING", "ANALYZED", "FILLING", "COMPLETED"]).optional(),
  title: z.string().trim().min(1).optional(),
});

export async function PATCH(
  req: NextRequest,
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

    const body = await req.json();
    const parsed = updateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid data" }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {};

    if (parsed.data.title) {
      updateData.title = parsed.data.title;
    }

    if (parsed.data.status) {
      updateData.status = parsed.data.status;
    }

    if (parsed.data.fields) {
      // Merge new values and fieldState into existing fields
      const existingFields = form.fields as Array<Record<string, unknown>>;
      const updates = new Map(parsed.data.fields.map((f) => [f.id, f]));

      const mergedFields = existingFields.map((f) => {
        const update = updates.get(f.id as string);
        if (update) {
          const merged: Record<string, unknown> = { ...f };
          if (update.value !== undefined) merged.value = update.value;
          if (update.fieldState !== undefined) merged.fieldState = update.fieldState;
          return merged;
        }
        return f;
      });

      updateData.fields = mergedFields;
      updateData.filledData = Object.fromEntries(
        mergedFields
          .filter((f) => f.value)
          .map((f) => [f.id, f.value])
      );
    }

    const updated = await prisma.form.update({
      where: { id },
      data: updateData,
    });

    // When a form reaches COMPLETED — extract memory and send email (both non-blocking)
    if (parsed.data.status === "COMPLETED") {
      const currentFields = (updated.fields ?? form.fields) as unknown as FormField[];
      extractMemoryFromForm(session.user.id, id, updated.title, currentFields).catch(
        () => { /* best-effort */ }
      );
      if (session.user.email) {
        sendEmail(
          session.user.email,
          `Your form "${updated.title}" is ready`,
          React.createElement(FormCompletedEmail, { formTitle: updated.title, formId: id, appUrl: APP_URL })
        ).catch(() => { /* best-effort */ });
      }
    }

    return NextResponse.json({ form: updated });
  } catch (err) {
    return handleApiError(err, "PATCH /api/forms/[id]");
  }
}
