import { NextRequest, NextResponse } from "next/server";
import { SignJWT } from "jose";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import StalledFormEmail from "@/emails/StalledFormEmail";
import * as React from "react";
import type { FormField } from "@/lib/ai/analyze-form";
import { log } from "@/lib/logger";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://getformpilot.com";
const CRON_SECRET = process.env.CRON_SECRET ?? "";

// Forms uploaded 48–72h ago qualify (once-only window)
const WINDOW_START_MS = 72 * 60 * 60 * 1000;
const WINDOW_END_MS = 48 * 60 * 60 * 1000;

// Profile completeness threshold below which we show the profile CTA
const PROFILE_LOW_THRESHOLD = 0.5;

/** Generate an unsubscribe JWT for this user. */
async function makeUnsubscribeToken(userId: string): Promise<string> {
  const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET ?? CRON_SECRET);
  return new SignJWT({ userId, type: "reminder" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("365d")
    .sign(secret);
}

export async function POST(req: NextRequest) {
  // Auth: Vercel passes the secret as Authorization: Bearer <secret>
  const authHeader = req.headers.get("authorization");
  if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const windowStart = new Date(now.getTime() - WINDOW_START_MS); // 72h ago
  const windowEnd = new Date(now.getTime() - WINDOW_END_MS);     // 48h ago

  let sent = 0;
  let skipped = 0;

  try {
    // Find forms uploaded in the 48–72h window, stalled email not yet sent
    const forms = await prisma.form.findMany({
      where: {
        createdAt: { gte: windowStart, lte: windowEnd },
        stalledEmailSentAt: null,
        status: { in: ["ANALYZED", "PENDING"] },
        user: {
          reminderEmailsEnabled: true,
          email: { not: undefined },
        },
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });

    // Check each form for zero autofill activity (all field values null/empty)
    const stalledForms = forms.filter((form) => {
      const fields = form.fields as unknown as FormField[];
      return fields.every((f) => !f.value || !String(f.value).trim());
    });

    if (stalledForms.length === 0) {
      return NextResponse.json({ sent: 0, skipped: 0, message: "No stalled forms found" });
    }

    // Group by userId — send at most one email per user (first qualifying form)
    const byUser = new Map<string, typeof stalledForms[0]>();
    for (const form of stalledForms) {
      if (!byUser.has(form.userId)) {
        byUser.set(form.userId, form);
      }
    }

    for (const [, form] of byUser) {
      const user = form.user;
      if (!user.email) { skipped++; continue; }

      // Compute profile completeness
      let profileIsLow = false;
      try {
        const profile = await prisma.profile.findUnique({
          where: { userId: form.userId },
          select: { data: true },
        });
        if (profile?.data && typeof profile.data === "object") {
          const pd = profile.data as Record<string, unknown>;
          const addr = (pd.address ?? {}) as Record<string, unknown>;
          const CORE_FIELDS = [
            pd.firstName, pd.lastName, pd.email, pd.phone, pd.dateOfBirth,
            addr.street, addr.city, addr.state, addr.zip, addr.country,
          ];
          const filled = CORE_FIELDS.filter((v) => v && String(v).trim()).length;
          profileIsLow = filled / CORE_FIELDS.length < PROFILE_LOW_THRESHOLD;
        } else {
          profileIsLow = true; // No profile at all = low
        }
      } catch {
        profileIsLow = false;
      }

      const unsubscribeToken = await makeUnsubscribeToken(form.userId);
      const unsubscribeUrl = `${APP_URL}/api/email/unsubscribe?token=${unsubscribeToken}`;

      try {
        await sendEmail(
          user.email,
          `Your ${form.title} is waiting — let FormPilot fill it in`,
          React.createElement(StalledFormEmail, {
            formTitle: form.title,
            formId: form.id,
            profileIsLow,
            unsubscribeUrl,
            appUrl: APP_URL,
          })
        );

        await prisma.form.update({
          where: { id: form.id },
          data: { stalledEmailSentAt: now },
        });

        sent++;
      } catch (err) {
        log.warn("Failed to send stalled-form email", {
          route: "POST /api/cron/stalled-forms",
          formId: form.id,
          userId: form.userId,
          error: err instanceof Error ? err.message : String(err),
        });
        skipped++;
      }
    }

    log.info("Stalled-forms cron complete", {
      route: "POST /api/cron/stalled-forms",
      sent,
      skipped,
      candidates: stalledForms.length,
    });

    return NextResponse.json({ sent, skipped });
  } catch (err) {
    log.error("Stalled-forms cron failed", {
      route: "POST /api/cron/stalled-forms",
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
