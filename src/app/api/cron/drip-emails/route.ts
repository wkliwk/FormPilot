import { NextRequest, NextResponse } from "next/server";
import { SignJWT } from "jose";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import DripEmail2 from "@/emails/DripEmail2";
import DripEmail3 from "@/emails/DripEmail3";
import * as React from "react";
import { log } from "@/lib/logger";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://getformpilot.com";
const CRON_SECRET = process.env.CRON_SECRET ?? "";

// Email 2: send to users created 48–72h ago, no completed forms
const DRIP2_WINDOW_START_MS = 72 * 60 * 60 * 1000;
const DRIP2_WINDOW_END_MS   = 48 * 60 * 60 * 1000;

// Email 3: send to users created 7–8d ago, no completed forms
const DRIP3_WINDOW_START_MS = 8 * 24 * 60 * 60 * 1000;
const DRIP3_WINDOW_END_MS   = 7 * 24 * 60 * 60 * 1000;

async function makeUnsubscribeToken(userId: string): Promise<string> {
  const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET ?? CRON_SECRET);
  return new SignJWT({ userId, type: "reminder" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("365d")
    .sign(secret);
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  let sent2 = 0, sent3 = 0, skipped = 0;

  try {
    // --- Email 2 candidates ---
    const drip2Start = new Date(now.getTime() - DRIP2_WINDOW_START_MS);
    const drip2End   = new Date(now.getTime() - DRIP2_WINDOW_END_MS);

    const drip2Users = await prisma.user.findMany({
      where: {
        createdAt: { gte: drip2Start, lte: drip2End },
        drip2SentAt: null,
        reminderEmailsEnabled: true,
        email: { not: undefined },
      },
      select: { id: true, email: true, name: true },
    });

    for (const user of drip2Users) {
      if (!user.email) { skipped++; continue; }
      const hasCompleted = await prisma.form.count({ where: { userId: user.id, status: "COMPLETED" } }) > 0;
      if (hasCompleted) {
        // Still mark as sent so we don't re-evaluate this user
        await prisma.user.update({ where: { id: user.id }, data: { drip2SentAt: now } });
        skipped++;
        continue;
      }
      const token = await makeUnsubscribeToken(user.id);
      const unsubscribeUrl = `${APP_URL}/api/email/unsubscribe?token=${token}`;
      try {
        await sendEmail(
          user.email,
          "Your profile is 80% of the work — fill it once, autofill everything",
          React.createElement(DripEmail2, { name: user.name ?? undefined, appUrl: APP_URL, unsubscribeUrl })
        );
        await prisma.user.update({ where: { id: user.id }, data: { drip2SentAt: now } });
        sent2++;
      } catch (err) {
        log.warn("Failed to send drip email 2", { userId: user.id, error: err instanceof Error ? err.message : String(err) });
        skipped++;
      }
    }

    // --- Email 3 candidates ---
    const drip3Start = new Date(now.getTime() - DRIP3_WINDOW_START_MS);
    const drip3End   = new Date(now.getTime() - DRIP3_WINDOW_END_MS);

    const drip3Users = await prisma.user.findMany({
      where: {
        createdAt: { gte: drip3Start, lte: drip3End },
        drip3SentAt: null,
        reminderEmailsEnabled: true,
        email: { not: undefined },
      },
      select: { id: true, email: true, name: true },
    });

    for (const user of drip3Users) {
      if (!user.email) { skipped++; continue; }
      const hasCompleted = await prisma.form.count({ where: { userId: user.id, status: "COMPLETED" } }) > 0;
      if (hasCompleted) {
        await prisma.user.update({ where: { id: user.id }, data: { drip3SentAt: now } });
        skipped++;
        continue;
      }
      const token = await makeUnsubscribeToken(user.id);
      const unsubscribeUrl = `${APP_URL}/api/email/unsubscribe?token=${token}`;
      try {
        await sendEmail(
          user.email,
          "See what FormPilot can do — upload a form in 60 seconds",
          React.createElement(DripEmail3, { name: user.name ?? undefined, appUrl: APP_URL, unsubscribeUrl })
        );
        await prisma.user.update({ where: { id: user.id }, data: { drip3SentAt: now } });
        sent3++;
      } catch (err) {
        log.warn("Failed to send drip email 3", { userId: user.id, error: err instanceof Error ? err.message : String(err) });
        skipped++;
      }
    }

    log.info("Drip emails cron complete", { route: "POST /api/cron/drip-emails", sent2, sent3, skipped });
    return NextResponse.json({ sent2, sent3, skipped });
  } catch (err) {
    log.error("Drip emails cron failed", { route: "POST /api/cron/drip-emails", error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
