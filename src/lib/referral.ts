import { prisma } from "@/lib/prisma";

export const REFERRAL_BONUS_PER_REFERRAL = 1;
export const REFERRAL_MAX_BONUS = 5;

/** Generates a short alphanumeric referral code. */
function generateCode(): string {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789"; // no ambiguous chars (0/O, 1/l/I)
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

/** Returns the user's referral code, creating one if they don't have it yet. */
export async function getOrCreateReferralCode(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { referralCode: true } });
  if (user?.referralCode) return user.referralCode;

  // Generate a unique code — retry on collision (extremely rare)
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateCode();
    try {
      await prisma.user.update({ where: { id: userId }, data: { referralCode: code } });
      return code;
    } catch {
      // Unique constraint violation — try another code
    }
  }
  throw new Error("Failed to generate referral code");
}

/** Returns the userId for a given referral code, or null if not found. */
export async function getUserByReferralCode(code: string): Promise<string | null> {
  const user = await prisma.user.findUnique({ where: { referralCode: code }, select: { id: true } });
  return user?.id ?? null;
}

/**
 * Grants a referral bonus to the referrer when a referred user uploads their first form.
 * Idempotent: uses the referred user's referredBy field; only grants once (checks existing forms count).
 */
export async function grantReferralBonus(referredUserId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: referredUserId },
    select: { referredBy: true },
  });
  if (!user?.referredBy) return;

  const referrerId = user.referredBy;

  // Idempotency: only grant if the referred user has exactly 1 form (the one just uploaded)
  const formCount = await prisma.form.count({ where: { userId: referredUserId } });
  if (formCount !== 1) return; // already got credit for this referral

  // Apply bonus, capped at REFERRAL_MAX_BONUS
  await prisma.usageCount.upsert({
    where: { userId: referrerId },
    create: { userId: referrerId, formsThisMonth: 0, bonusForms: REFERRAL_BONUS_PER_REFERRAL },
    update: {
      bonusForms: { increment: REFERRAL_BONUS_PER_REFERRAL },
    },
  });

  // Re-read to enforce cap
  const usage = await prisma.usageCount.findUnique({ where: { userId: referrerId }, select: { bonusForms: true } });
  if (usage && usage.bonusForms > REFERRAL_MAX_BONUS) {
    await prisma.usageCount.update({
      where: { userId: referrerId },
      data: { bonusForms: REFERRAL_MAX_BONUS },
    });
  }
}

const COMPLETION_BONUS = 2;

/**
 * Grants +2 bonus forms to the referrer when a referred user completes their first form.
 * Idempotent: uses ReferralReward table — one reward per referee, regardless of form count.
 */
export async function awardReferralBonus(referredUserId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: referredUserId },
    select: { referredBy: true },
  });
  if (!user?.referredBy) return;

  const referrerId = user.referredBy;

  // Idempotency: skip if already rewarded for this referee
  const existing = await prisma.referralReward.findUnique({ where: { refereeId: referredUserId } });
  if (existing) return;

  // Record reward first (prevents races on concurrent completions)
  await prisma.referralReward.create({ data: { referrerId, refereeId: referredUserId } });

  // Apply bonus, capped at REFERRAL_MAX_BONUS
  await prisma.usageCount.upsert({
    where: { userId: referrerId },
    create: { userId: referrerId, formsThisMonth: 0, bonusForms: Math.min(COMPLETION_BONUS, REFERRAL_MAX_BONUS) },
    update: { bonusForms: { increment: COMPLETION_BONUS } },
  });

  // Enforce cap
  const usage = await prisma.usageCount.findUnique({ where: { userId: referrerId }, select: { bonusForms: true } });
  if (usage && usage.bonusForms > REFERRAL_MAX_BONUS) {
    await prisma.usageCount.update({ where: { userId: referrerId }, data: { bonusForms: REFERRAL_MAX_BONUS } });
  }
}

/** Returns the number of successful referrals for a user (users who signed up and uploaded ≥1 form). */
export async function getReferralStats(userId: string): Promise<{ count: number; bonusForms: number }> {
  const [count, usage] = await Promise.all([
    prisma.user.count({
      where: {
        referredBy: userId,
        forms: { some: {} }, // at least one form uploaded
      },
    }),
    prisma.usageCount.findUnique({ where: { userId }, select: { bonusForms: true } }),
  ]);
  return { count, bonusForms: usage?.bonusForms ?? 0 };
}
