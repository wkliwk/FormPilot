import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import LaunchNotifyEmail from "@/emails/LaunchNotifyEmail";
import * as React from "react";
import { log } from "@/lib/logger";

const CRON_SECRET = process.env.CRON_SECRET ?? "";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://getformpilot.com";
const BATCH_SIZE = 50; // Resend rate limit safety

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const phUrl = process.env.NEXT_PUBLIC_PH_URL;
  if (!phUrl) {
    return NextResponse.json({ error: "NEXT_PUBLIC_PH_URL is not set" }, { status: 400 });
  }

  // Only send to subscribers who haven't received the blast yet
  const subscribers = await prisma.launchNotify.findMany({
    where: { blastSentAt: null },
    select: { id: true, email: true },
  });

  if (subscribers.length === 0) {
    return NextResponse.json({ sent: 0, skipped: 0, message: "No unsent subscribers" });
  }

  let sent = 0;
  let failed = 0;

  // Process in batches to stay within rate limits
  for (let i = 0; i < subscribers.length; i += BATCH_SIZE) {
    const batch = subscribers.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map(async (sub) => {
        try {
          await sendEmail(
            sub.email,
            "FormPilot is live on Product Hunt — go upvote now! 🎉",
            React.createElement(LaunchNotifyEmail, { phUrl })
          );
          await prisma.launchNotify.update({
            where: { id: sub.id },
            data: { blastSentAt: new Date() },
          });
          sent++;
        } catch (err) {
          log.warn("launch-notify-blast: failed to send", {
            email: sub.email,
            error: err instanceof Error ? err.message : String(err),
          });
          failed++;
        }
      })
    );
  }

  log.info("launch-notify-blast complete", { sent, failed, total: subscribers.length, appUrl: APP_URL });
  return NextResponse.json({ sent, failed, total: subscribers.length });
}
