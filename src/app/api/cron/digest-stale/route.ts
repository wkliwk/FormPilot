import { NextRequest, NextResponse } from "next/server";
import { SignJWT } from "jose";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import StaleFormsDigestEmail from "@/emails/StaleFormsDigestEmail";
import * as React from "react";
import type { FormField } from "@/lib/ai/analyze-form";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://getformpilot.com";
const CRON_SECRET = process.env.CRON_SECRET ?? "";

// 14 days — forms untouched longer than this are eligible for the digest
const STALE_MS = 14 * 24 * 60 * 60 * 1000;
// 7 days — don't send the digest more than once a week per user
const DIGEST_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;
// Max forms to list in a single digest email
const MAX_FORMS_PER_DIGEST = 3;

async function makeUnsubscribeToken(userId: string): Promise<string> {
  const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET ?? CRON_SECRET);
  return new SignJWT({ userId, type: "digest" })
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
  const staleCutoff = new Date(now.getTime() - STALE_MS);
  const digestCooldownCutoff = new Date(now.getTime() - DIGEST_COOLDOWN_MS);

  let sent = 0;
  let skipped = 0;

  try {
    // Query stale forms and their users in one pass (same pattern as nudge-abandoned)
    const staleForms = await prisma.form.findMany({
      where: {
        status: { not: "COMPLETED" },
        updatedAt: { lte: staleCutoff },
        user: {
          reminderEmailsEnabled: true,
          digestUnsubscribed: false,
          OR: [
            { lastDigestSentAt: null },
            { lastDigestSentAt: { lte: digestCooldownCutoff } },
          ],
        },
      },
      select: {
        id: true,
        title: true,
        category: true,
        fields: true,
        userId: true,
        user: {
          select: {
            id: true,
            email: true,
            lastDigestSentAt: true,
          },
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 1500, // Safety cap — groups into per-user sets below
    });

    // Group forms by userId, preserving order (most stale first)
    const byUser = new Map<string, typeof staleForms>();
    for (const form of staleForms) {
      const existing = byUser.get(form.userId) ?? [];
      if (existing.length < MAX_FORMS_PER_DIGEST) {
        existing.push(form);
        byUser.set(form.userId, existing);
      }
    }

    // One digest per user
    for (const [, forms] of byUser) {
      const user = forms[0].user;
      if (!user.email) { skipped++; continue; }

      const digestForms = forms.map((form) => {
        const fields = form.fields as unknown as FormField[];
        const total = fields.length;
        const filled = fields.filter((f) => f.value && String(f.value).trim()).length;
        const completionPct = total > 0 ? Math.round((filled / total) * 100) : 0;
        return {
          id: form.id,
          title: form.title,
          category: form.category,
          completionPct,
        };
      });

      const unsubToken = await makeUnsubscribeToken(user.id);
      const unsubscribeUrl = `${APP_URL}/api/email/unsubscribe-digest?token=${unsubToken}`;

      try {
        await sendEmail(
          user.email,
          `You have ${digestForms.length} form${digestForms.length !== 1 ? "s" : ""} waiting to be finished`,
          React.createElement(StaleFormsDigestEmail, {
            staleCount: digestForms.length,
            forms: digestForms,
            unsubscribeUrl,
            appUrl: APP_URL,
          })
        );

        await prisma.user.update({
          where: { id: user.id },
          data: { lastDigestSentAt: now },
        });

        sent++;
      } catch {
        skipped++;
      }
    }
  } catch (err) {
    console.error("[cron/digest-stale] query failed:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }

  console.log(`[cron/digest-stale] sent=${sent} skipped=${skipped}`);
  return NextResponse.json({ sent, skipped });
}
