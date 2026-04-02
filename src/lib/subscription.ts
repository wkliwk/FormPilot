import { prisma } from "@/lib/prisma";

export const FREE_FORM_LIMIT = 5;

const ADMIN_EMAILS = new Set([
  "wkliwk@gmail.com",
  ...(process.env.ADMIN_EMAILS?.split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean) ?? []),
]);

/** Returns true if the user is a hardcoded admin — bypasses all quota and Pro checks */
async function isAdminUser(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });
  return !!user?.email && ADMIN_EMAILS.has(user.email.toLowerCase());
}

/** Returns true if the user has an active Pro subscription (or is an admin) */
export async function isProUser(userId: string): Promise<boolean> {
  if (await isAdminUser(userId)) return true;

  const sub = await prisma.subscription.findUnique({
    where: { userId },
    select: { status: true, currentPeriodEnd: true },
  });
  if (!sub) return false;
  if (sub.status !== "ACTIVE") return false;
  // Guard against expired periods that haven't been updated via webhook yet
  if (sub.currentPeriodEnd && sub.currentPeriodEnd < new Date()) return false;
  return true;
}

/** Returns the user's current plan: "pro" | "free" */
export async function getUserPlan(userId: string): Promise<"pro" | "free"> {
  return (await isProUser(userId)) ? "pro" : "free";
}

/** Returns { allowed: true } or { allowed: false, formsUsed, limit } */
export async function canUploadForm(userId: string): Promise<
  | { allowed: true }
  | { allowed: false; formsUsed: number; limit: number }
> {
  if (await isProUser(userId)) return { allowed: true };

  // getOrCreateUsage lazily resets the counter when a new calendar month starts
  const usage = await getOrCreateUsage(userId);
  if (usage.formsThisMonth < FREE_FORM_LIMIT) return { allowed: true };
  return { allowed: false, formsUsed: usage.formsThisMonth, limit: FREE_FORM_LIMIT };
}

/** Increments the user's monthly form usage counter */
export async function incrementFormUsage(userId: string): Promise<void> {
  await getOrCreateUsage(userId); // ensure record exists
  await prisma.usageCount.update({
    where: { userId },
    data: { formsThisMonth: { increment: 1 }, updatedAt: new Date() },
  });
}

/** Returns current usage count, creating the record if it doesn't exist.
 *  Lazily resets the counter when a new calendar month has started — necessary
 *  because free users never pay, so the Stripe invoice webhook never fires for them. */
export async function getOrCreateUsage(userId: string) {
  const record = await prisma.usageCount.upsert({
    where: { userId },
    create: { userId, formsThisMonth: 0, periodStart: new Date() },
    update: {},
  });

  const now = new Date();
  const periodStart = new Date(record.periodStart);
  const isNewMonth =
    now.getFullYear() !== periodStart.getFullYear() ||
    now.getMonth() !== periodStart.getMonth();

  if (isNewMonth) {
    await resetMonthlyUsage(userId);
    return { ...record, formsThisMonth: 0, periodStart: now };
  }

  return record;
}

/** Resets monthly usage — called from Stripe webhook on invoice.paid */
export async function resetMonthlyUsage(userId: string): Promise<void> {
  await prisma.usageCount.upsert({
    where: { userId },
    create: { userId, formsThisMonth: 0, periodStart: new Date() },
    update: { formsThisMonth: 0, periodStart: new Date(), updatedAt: new Date() },
  });
}
