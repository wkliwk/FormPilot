import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { handleApiError } from "@/lib/api-error";
import { isProUser } from "@/lib/subscription";
import { fillPDF } from "@/lib/pdf/fill";
import { generateSummaryPDF } from "@/lib/pdf/generate-summary";
import { Resend } from "resend";
import { render } from "@react-email/render";
import FilledFormEmail from "@/emails/FilledFormEmail";
import type { FormField } from "@/lib/ai/analyze-form";
import * as React from "react";

const FROM = "FormPilot <hello@getformpilot.com>";
const DAILY_SEND_LIMIT = 5;

const BodySchema = z.object({
  to: z.string().email("Invalid email address"),
  subject: z.string().min(1).max(200).optional(),
  message: z.string().max(500).optional(),
});

function getResend() {
  return new Resend(process.env.RESEND_API_KEY);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  let body: z.infer<typeof BodySchema>;
  try {
    const raw = await req.json();
    body = BodySchema.parse(raw);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors[0]?.message ?? "Invalid input" }, { status: 400 });
    }
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    const form = await prisma.form.findUnique({ where: { id } });

    if (!form || form.userId !== session.user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Pro gate: free users may only send to their own account email
    const isPro = await isProUser(session.user.id);
    if (!isPro) {
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { email: true },
      });
      if (user?.email && body.to.toLowerCase() !== user.email.toLowerCase()) {
        return NextResponse.json(
          { error: "Free plan: you can only send to your own account email. Upgrade to Pro to send to any address." },
          { status: 403 }
        );
      }
    }

    // Rate limit: 5 sends per form per day using filledData._emailSends
    const filledData = (form.filledData ?? {}) as Record<string, unknown>;
    const existingSends = Array.isArray(filledData._emailSends) ? (filledData._emailSends as string[]) : [];
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    const recentSends = existingSends.filter((ts) => new Date(ts).getTime() > cutoff);
    if (recentSends.length >= DAILY_SEND_LIMIT) {
      return NextResponse.json(
        { error: `Email limit reached — max ${DAILY_SEND_LIMIT} sends per form per day.` },
        { status: 429 }
      );
    }

    const fields = form.fields as unknown as FormField[];
    const filledFields = fields.filter((f) => f.value);

    if (filledFields.length === 0) {
      return NextResponse.json({ error: "No filled fields to export" }, { status: 400 });
    }

    // Generate the attachment — same logic as export route
    let attachmentContent: Buffer;
    let attachmentFilename: string;
    let attachmentContentType: string;

    const safeTitle = form.title.replace(/[^a-z0-9]/gi, "_");

    if (form.sourceType === "PDF" && form.fileBytes) {
      try {
        const originalBuffer = Buffer.from(form.fileBytes);
        attachmentContent = Buffer.from(await fillPDF(originalBuffer, fields));
        attachmentFilename = `${safeTitle}_filled.pdf`;
        attachmentContentType = "application/pdf";
      } catch {
        // Fall through to summary PDF
        const summaryBuffer = await generateSummaryPDF(form.title, fields, new Date());
        attachmentContent = Buffer.from(summaryBuffer);
        attachmentFilename = `${safeTitle}_summary.pdf`;
        attachmentContentType = "application/pdf";
      }
    } else if (form.sourceType === "IMAGE") {
      const summaryBuffer = await generateSummaryPDF(form.title, fields, new Date());
      attachmentContent = Buffer.from(summaryBuffer);
      attachmentFilename = `${safeTitle}_summary.pdf`;
      attachmentContentType = "application/pdf";
    } else {
      // JSON fallback
      const exportData = {
        title: form.title,
        exportedAt: new Date().toISOString(),
        fields: filledFields.map((f) => ({ label: f.label, value: f.value })),
      };
      attachmentContent = Buffer.from(JSON.stringify(exportData, null, 2));
      attachmentFilename = `${safeTitle}_filled.json`;
      attachmentContentType = "application/json";
    }

    // Render email
    const subject = body.subject ?? `Your completed ${form.title}`;
    const html = await render(
      React.createElement(FilledFormEmail, {
        formTitle: form.title,
        senderMessage: body.message,
      })
    );

    if (!process.env.RESEND_API_KEY) {
      // Dev/test: skip actual send but record the attempt
    } else {
      await getResend().emails.send({
        from: FROM,
        to: body.to,
        subject,
        html,
        attachments: [
          {
            filename: attachmentFilename,
            content: attachmentContent,
            contentType: attachmentContentType,
          },
        ],
      });
    }

    // Record this send in filledData for rate limiting
    const updatedSends = [...recentSends, new Date().toISOString()];
    await prisma.form.update({
      where: { id },
      data: {
        filledData: { ...(filledData as object), _emailSends: updatedSends },
      },
    });

    return NextResponse.json({ sent: true, to: body.to });
  } catch (err) {
    return handleApiError(err, "POST /api/forms/[id]/send-email");
  }
}
