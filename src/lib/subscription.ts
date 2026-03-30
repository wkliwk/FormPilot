import { prisma } from "@/lib/prisma";

export const FREE_FORM_LIMIT = 5;

/** Returns true if the user has an active Pro subscription */
export async function isProUser(userId: string): Promise<boolean> {
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

/** Returns current usage count, creating the record if it doesn't exist */
export async function getOrCreateUsage(userId: string) {
  return prisma.usageCount.upsert({
    where: { userId },
    create: { userId, formsThisMonth: 0, periodStart: new Date() },
    update: {},
  });
}

/** Resets monthly usage — called from Stripe webhook on invoice.paid */
export async function resetMonthlyUsage(userId: string): Promise<void> {
  await prisma.usageCount.upsert({
    where: { userId },
    create: { userId, formsThisMonth: 0, periodStart: new Date() },
    update: { formsThisMonth: 0, periodStart: new Date(), updatedAt: new Date() },
  });
}
