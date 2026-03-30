import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "crypto";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import FormAbandonedEmail from "@/emails/FormAbandonedEmail";
import * as React from "react";
import type { FormField } from "@/lib/ai/analyze-form";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://getformpilot.com";
const CRON_SECRET = process.env.CRON_SECRET ?? "";

// 48 hours — forms idle longer than this are eligible for nudge
const IDLE_MS = 48 * 60 * 60 * 1000;
// 7 days — don't nudge more than once per week per form
const NUDGE_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

/** Generate a signed token for the dismiss link. */
function makeDismissToken(formId: string, userId: string): string {
  return createHmac("sha256", CRON_SECRET).update(`${formId}:${userId}`).digest("hex");
}

export async function POST(req: NextRequest) {
  // Auth: Vercel passes the secret as Authorization: Bearer <secret>
  const authHeader = req.headers.get("authorization");
  if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const idleCutoff = new Date(now.getTime() - IDLE_MS);
  const nudgeCutoff = new Date(now.getTime() - NUDGE_COOLDOWN_MS);

  let sent = 0;
  let skipped = 0;

  try {
    // Find abandoned forms with their users
    const forms = await prisma.form.findMany({
      where: {
        status: { in: ["FILLING", "ANALYZED"] },
        updatedAt: { lte: idleCutoff },
        OR: [
          { lastNudgedAt: null },
          { lastNudgedAt: { lte: nudgeCutoff } },
        ],
      },
      include: {
        user: {
          select: { id: true, email: true, name: true },
        },
      },
      take: 500, // Safety cap per run
    });

    for (const form of forms) {
      const { user } = form;
      if (!user.email) { skipped++; continue; }

      const fields = form.fields as unknown as FormField[];
      const totalFields = fields.length;
      const filledCount = fields.filter((f) => f.value && String(f.value).trim()).length;

      const token = makeDismissToken(form.id, user.id);
      const dismissUrl = `${APP_URL}/api/forms/${form.id}/dismiss?token=${token}`;

      try {
        await sendEmail(
          user.email,
          `Still need help with "${form.title}"?`,
          React.createElement(FormAbandonedEmail, {
            formTitle: form.title,
            formId: form.id,
            filledCount,
            totalFields,
            dismissUrl,
            appUrl: APP_URL,
          })
        );

        await prisma.form.update({
          where: { id: form.id },
          data: { lastNudgedAt: now },
        });

        sent++;
      } catch {
        // Best-effort — don't let one failure block the rest
        skipped++;
      }
    }
  } catch (err) {
    console.error("[cron/nudge-abandoned] query failed:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }

  console.log(`[cron/nudge-abandoned] sent=${sent} skipped=${skipped}`);
  return NextResponse.json({ sent, skipped });
}
