import { NextRequest, NextResponse } from "next/server";
import { SignJWT } from "jose";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import DeadlineReminderEmail from "@/emails/DeadlineReminderEmail";
import * as React from "react";
import { log } from "@/lib/logger";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://getformpilot.com";
const CRON_SECRET = process.env.CRON_SECRET ?? "";

// Only remind within this window before due date
const REMIND_WINDOW_DAYS = 7;
// Don't send another reminder for the same form within this many days
const COOLDOWN_DAYS = 3;

async function makeUnsubscribeUrl(userId: string): Promise<string> {
  const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET ?? CRON_SECRET);
  const token = await new SignJWT({ userId, type: "deadline_reminder" })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("90d")
    .sign(secret);
  return `${APP_URL}/api/email/unsubscribe?token=${token}`;
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const windowEnd = new Date(now.getTime() + REMIND_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const cooldownCutoff = new Date(now.getTime() - COOLDOWN_DAYS * 24 * 60 * 60 * 1000);

  // Find all incomplete forms with a due date in the next 7 days
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

    // Check cooldown — skip if we already sent a reminder recently
    const recentReminder = await prisma.formReminder.findFirst({
      where: { formId: form.id, sentAt: { gte: cooldownCutoff } },
    });
    if (recentReminder) {
      skipped++;
      continue;
    }

    const dueDate = form.dueDate!;
    const msUntilDue = dueDate.getTime() - now.getTime();
    const daysUntilDue = Math.ceil(msUntilDue / (24 * 60 * 60 * 1000));
    const dueDateFormatted = dueDate.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });

    try {
      const unsubscribeUrl = await makeUnsubscribeUrl(form.userId);
      await sendEmail(
        form.user.email,
        daysUntilDue <= 1
          ? `⚠️ "${form.title}" is due tomorrow`
          : `"${form.title}" is due in ${daysUntilDue} days`,
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
        data: { formId: form.id, userId: form.userId, daysBeforeDue: daysUntilDue },
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
