import { NextRequest, NextResponse } from "next/server";
import { SignJWT } from "jose";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import DeadlineReminderEmail from "@/emails/DeadlineReminderEmail";
import * as React from "react";
import { log } from "@/lib/logger";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://getformpilot.com";
const CRON_SECRET = process.env.CRON_SECRET ?? "";

// Reminder milestones in days-before-due. Three emails max per form per deadline.
// Defined in descending order so we always send the most-advance applicable one first.
const MILESTONES = [7, 2, 1]; // 7 days out, 2 days out, day-of (1)

async function makeUnsubscribeUrl(userId: string): Promise<string> {
  const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET ?? CRON_SECRET);
  const token = await new SignJWT({ userId, type: "deadline_reminder" })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("90d")
    .sign(secret);
  return `${APP_URL}/api/email/unsubscribe?token=${token}`;
}

// Determine which milestone to send for a form at `daysUntilDue`
// Returns the lowest milestone bucket that hasn't been sent yet
// e.g. 6 days away → 7-day bucket; 2 days away → 2-day bucket
function getMilestoneBucket(daysUntilDue: number): number | null {
  // Find the smallest milestone that is >= daysUntilDue (we're within that window)
  for (const m of [...MILESTONES].reverse()) {
    if (daysUntilDue <= m) return m;
  }
  return null;
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const maxMilestone = Math.max(...MILESTONES);
  const windowEnd = new Date(now.getTime() + maxMilestone * 24 * 60 * 60 * 1000);

  // Find all incomplete forms with a due date within the largest milestone window
  const forms = await prisma.form.findMany({
    where: {
      dueDate: { gte: now, lte: windowEnd },
      status: { not: "COMPLETED" },
    },
    select: {
      id: true,
      title: true,
      dueDate: true,
      userId: true,
      user: { select: { email: true, reminderEmailsEnabled: true } },
    },
  });

  log.info("deadline-reminders cron started", { candidateForms: forms.length });

  let sent = 0;
  let skipped = 0;

  for (const form of forms) {
    if (!form.user.email || !form.user.reminderEmailsEnabled) {
      skipped++;
      continue;
    }

    const dueDate = form.dueDate!;
    const msUntilDue = dueDate.getTime() - now.getTime();
    const daysUntilDue = Math.ceil(msUntilDue / (24 * 60 * 60 * 1000));

    // Determine which milestone bucket we're in
    const bucket = getMilestoneBucket(daysUntilDue);
    if (bucket === null) {
      skipped++;
      continue;
    }

    // Skip if we already sent a reminder at or below this bucket
    const alreadySent = await prisma.formReminder.findFirst({
      where: { formId: form.id, daysBeforeDue: { lte: bucket } },
    });
    if (alreadySent) {
      skipped++;
      continue;
    }

    const dueDateFormatted = dueDate.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });

    try {
      const unsubscribeUrl = await makeUnsubscribeUrl(form.userId);
      const subject = daysUntilDue <= 1
        ? `⚠️ "${form.title}" is due today`
        : daysUntilDue <= 2
          ? `⏰ "${form.title}" is due in 2 days`
          : `"${form.title}" is due in ${daysUntilDue} days`;

      await sendEmail(
        form.user.email,
        subject,
        React.createElement(DeadlineReminderEmail, {
          formTitle: form.title,
          formId: form.id,
          daysUntilDue,
          dueDateFormatted,
          unsubscribeUrl,
          appUrl: APP_URL,
        })
      );

      await prisma.formReminder.create({
        data: { formId: form.id, userId: form.userId, daysBeforeDue: bucket },
      });
      sent++;
    } catch (err) {
      log.warn("deadline reminder send failed", {
        formId: form.id,
        error: err instanceof Error ? err.message : String(err),
      });
      skipped++;
    }
  }

  log.info("deadline-reminders cron finished", { sent, skipped });
  return NextResponse.json({ sent, skipped });
}
