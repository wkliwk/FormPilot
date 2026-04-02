import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getStripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const plan = req.nextUrl.searchParams.get("plan") === "annual" ? "annual" : "monthly";
  const priceId =
    plan === "annual"
      ? (process.env.STRIPE_ANNUAL_PRICE_ID ?? process.env.STRIPE_PRO_PRICE_ID!)
      : process.env.STRIPE_PRO_PRICE_ID!;

  const stripe = getStripe();
  const userId = session.user.id;
  const userEmail = session.user.email ?? undefined;

  // Get or create Stripe customer
  const sub = await prisma.subscription.findUnique({ where: { userId } });
  let customerId = sub?.stripeCustomerId;

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: userEmail,
      metadata: { userId },
    });
    customerId = customer.id;
    await prisma.subscription.upsert({
      where: { userId },
      create: { userId, stripeCustomerId: customerId, status: "INACTIVE" },
      update: { stripeCustomerId: customerId },
    });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3300";

  const checkoutSession = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${appUrl}/dashboard/billing?success=1`,
    cancel_url: `${appUrl}/dashboard/billing?canceled=1`,
    metadata: { userId },
  });

  return NextResponse.json({ url: checkoutSession.url });
}
