import { NextRequest, NextResponse } from "next/server";
import { SignJWT } from "jose";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import WeeklyDigestEmail from "@/emails/WeeklyDigestEmail";
import * as React from "react";
import { log } from "@/lib/logger";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://getformpilot.com";
const CRON_SECRET = process.env.CRON_SECRET ?? "";

// Don't send to users who were active in the last 48h
const ACTIVE_WINDOW_MS = 48 * 60 * 60 * 1000;
// Profile completeness threshold — include user if below this
const PROFILE_SCORE_THRESHOLD = 80;
// Max incomplete forms to list per email
const MAX_FORMS = 3;

/*
 * Profile completeness score — weighted category scheme (mirrors dashboard widget).
 * Identity/Contact/Address = 3, DOB/Employment = 2, Documents = 1 (total 14pt).
 * Score = round(filledWeight / 14 * 100)
 */
function computeProfileScore(profileData: Record<string, unknown> | null): {
  score: number;
  missingCategories: string[];
} {
  if (!profileData) return { score: 0, missingCategories: ["Name", "Contact info", "Address"] };
  const addr = (profileData.address ?? {}) as Record<string, unknown>;
  const categories = [
    { name: "Name",              weight: 3, filled: !!(profileData.firstName && profileData.lastName) },
    { name: "Contact info",      weight: 3, filled: !!(profileData.email && profileData.phone) },
    { name: "Address",           weight: 3, filled: !!(addr.street && addr.city && addr.state) },
    { name: "Date of birth",     weight: 2, filled: !!profileData.dateOfBirth },
    { name: "Employment",        weight: 2, filled: !!profileData.employerName },
    { name: "Identity documents",weight: 1, filled: !!(profileData.ssn || profileData.passportNumber || profileData.driverLicense || profileData.taxId) },
  ];
  const TOTAL = 14;
  const filled = categories.filter((c) => c.filled).reduce((s, c) => s + c.weight, 0);
  const score = Math.round((filled / TOTAL) * 100);
  const missingCategories = categories
    .filter((c) => !c.filled)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 2)
    .map((c) => c.name);
  return { score, missingCategories };
}

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
  const activeCutoff = new Date(now.getTime() - ACTIVE_WINDOW_MS);
  let sent = 0;
  let skipped = 0;

  try {
    // Find users who have at least one incomplete form and have been inactive for >48h
    // Inactivity is approximated by checking that no form has been updated in the last 48h
    const candidates = await prisma.user.findMany({
      where: {
        email: { not: undefined },
        reminderEmailsEnabled: true,
        digestUnsubscribed: false,
        forms: {
          some: { status: { not: "COMPLETED" } },
          none: { updatedAt: { gte: activeCutoff } },
        },
      },
      select: {
        id: true,
        email: true,
        name: true,
        forms: {
          where: { status: { not: "COMPLETED" } },
          orderBy: { updatedAt: "desc" },
          take: MAX_FORMS,
          select: {
            id: true,
            title: true,
            fields: true,
            updatedAt: true,
          },
        },
        profile: { select: { data: true } },
      },
    });

    for (const user of candidates) {
      if (!user.email) { skipped++; continue; }
      if (user.forms.length === 0) { skipped++; continue; }

      // Compute fill % per form
      const formList = user.forms.map((f) => {
        const fields = f.fields as Array<{ value?: string }>;
        const total = fields.length;
        const filled = fields.filter((field) => field.value && String(field.value).trim()).length;
        const completionPct = total > 0 ? Math.round((filled / total) * 100) : 0;
        return {
          id: f.id,
          title: f.title,
          completionPct,
          updatedAt: f.updatedAt.toISOString(),
        };
      });

      // Profile score
      const profileData = user.profile?.data as Record<string, unknown> | null ?? null;
      const { score: profileScore, missingCategories } = computeProfileScore(profileData);

      // Skip if user has no incomplete forms AND profile is already complete enough
      // (additional guard — the query should have caught incomplete forms already)
      if (formList.length === 0 && profileScore >= PROFILE_SCORE_THRESHOLD) {
        skipped++;
        continue;
      }

      // Count all incomplete forms (not just paged)
      const totalIncompleteCount = await prisma.form.count({
        where: { userId: user.id, status: { not: "COMPLETED" } },
      });

      const token = await makeUnsubscribeToken(user.id);
      const unsubscribeUrl = `${APP_URL}/api/email/unsubscribe-digest?token=${token}`;
      const subject =
        totalIncompleteCount === 1
          ? "You have 1 form waiting — pick up where you left off"
          : `You have ${totalIncompleteCount} forms waiting — pick up where you left off`;

      try {
        await sendEmail(
          user.email,
          subject,
          React.createElement(WeeklyDigestEmail, {
            name: user.name ?? undefined,
            formCount: totalIncompleteCount,
            forms: formList,
            profileScore,
            missingCategories,
            primaryFormId: formList[0].id,
            appUrl: APP_URL,
            unsubscribeUrl,
          })
        );
        // Update lastDigestSentAt to prevent double-sending
        await prisma.user.update({
          where: { id: user.id },
          data: { lastDigestSentAt: now },
        });
        sent++;
      } catch (err) {
        log.warn("Failed to send weekly digest email", {
          userId: user.id,
          error: err instanceof Error ? err.message : String(err),
        });
        skipped++;
      }
    }

    log.info("Weekly digest cron complete", {
      route: "POST /api/cron/weekly-digest",
      sent,
      skipped,
      candidates: candidates.length,
    });
    return NextResponse.json({ sent, skipped, candidates: candidates.length });
  } catch (err) {
    log.error("Weekly digest cron failed", {
      route: "POST /api/cron/weekly-digest",
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
