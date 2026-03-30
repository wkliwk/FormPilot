import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { resetMonthlyUsage } from "@/lib/subscription";
import type Stripe from "stripe";

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  if (!sig || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.userId;
      const subscriptionId =
        typeof session.subscription === "string"
          ? session.subscription
          : session.subscription?.id;

      if (!userId || !subscriptionId) break;

      await prisma.subscription.upsert({
        where: { userId },
        create: {
          userId,
          stripeCustomerId: session.customer as string,
          stripeSubscriptionId: subscriptionId,
          status: "ACTIVE",
        },
        update: {
          stripeSubscriptionId: subscriptionId,
          status: "ACTIVE",
        },
      });
      break;
    }

    case "invoice.paid": {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId =
        typeof invoice.customer === "string"
          ? invoice.customer
          : (invoice.customer as Stripe.Customer)?.id;
      if (!customerId) break;

      const sub = await prisma.subscription.findUnique({
        where: { stripeCustomerId: customerId },
      });
      if (!sub) break;

      // Use invoice period_end as the subscription period end
      const periodEnd = invoice.period_end
        ? new Date(invoice.period_end * 1000)
        : null;

      await prisma.subscription.update({
        where: { stripeCustomerId: customerId },
        data: {
          status: "ACTIVE",
          ...(periodEnd ? { currentPeriodEnd: periodEnd } : {}),
        },
      });

      await resetMonthlyUsage(sub.userId);
      break;
    }

    case "customer.subscription.deleted":
    case "customer.subscription.updated": {
      const stripeSub = event.data.object as Stripe.Subscription;
      const customerId =
        typeof stripeSub.customer === "string"
          ? stripeSub.customer
          : (stripeSub.customer as Stripe.Customer)?.id;
      if (!customerId) break;

      const status =
        stripeSub.status === "active"
          ? "ACTIVE"
          : stripeSub.status === "past_due"
          ? "PAST_DUE"
          : "CANCELED";

      await prisma.subscription.updateMany({
        where: { stripeCustomerId: customerId },
        data: {
          status,
          stripeSubscriptionId: stripeSub.id,
        },
      });
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId =
        typeof invoice.customer === "string"
          ? invoice.customer
          : (invoice.customer as Stripe.Customer)?.id;
      if (!customerId) break;

      await prisma.subscription.updateMany({
        where: { stripeCustomerId: customerId },
        data: { status: "PAST_DUE" },
      });
      break;
    }
  }

  return NextResponse.json({ received: true });
}
