import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getUserPlan, getOrCreateUsage, FREE_FORM_LIMIT } from "@/lib/subscription";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const [plan, usage, sub] = await Promise.all([
    getUserPlan(userId),
    getOrCreateUsage(userId),
    prisma.subscription.findUnique({
      where: { userId },
      select: { status: true, currentPeriodEnd: true, stripeCustomerId: true },
    }),
  ]);

  return NextResponse.json({
    plan,
    formsUsed: usage.formsThisMonth,
    formsLimit: plan === "pro" ? null : FREE_FORM_LIMIT,
    periodStart: usage.periodStart,
    subscriptionStatus: sub?.status ?? null,
    currentPeriodEnd: sub?.currentPeriodEnd?.toISOString() ?? null,
    hasStripeCustomer: !!sub?.stripeCustomerId,
  });
}
