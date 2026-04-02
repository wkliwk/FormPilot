import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { resetMonthlyUsage } from "@/lib/subscription";
import { sendEmail } from "@/lib/email";
import ProUpgradeEmail from "@/emails/ProUpgradeEmail";
import PaymentFailedEmail from "@/emails/PaymentFailedEmail";
import type Stripe from "stripe";
import * as React from "react";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://getformpilot.com";

/** Extract subscription period end from item-level billing data (Stripe v21+) */
function getSubscriptionPeriodEnd(sub: Stripe.Subscription): Date | null {
  const firstItem = sub.items?.data?.[0];
  if (firstItem?.current_period_end) {
    return new Date(firstItem.current_period_end * 1000);
  }
  return null;
}

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

      // Fetch the Stripe subscription to get the accurate period end
      const stripeSub = await getStripe().subscriptions.retrieve(subscriptionId);
      const periodEnd = getSubscriptionPeriodEnd(stripeSub);

      await prisma.subscription.upsert({
        where: { userId },
        create: {
          userId,
          stripeCustomerId: session.customer as string,
          stripeSubscriptionId: subscriptionId,
          status: "ACTIVE",
          ...(periodEnd ? { currentPeriodEnd: periodEnd } : {}),
        },
        update: {
          stripeSubscriptionId: subscriptionId,
          status: "ACTIVE",
          ...(periodEnd ? { currentPeriodEnd: periodEnd } : {}),
        },
      });

      // Send Pro upgrade confirmation email (best-effort)
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (user?.email) {
        sendEmail(
          user.email,
          "You're now on FormPilot Pro",
          React.createElement(ProUpgradeEmail, { name: user.name ?? undefined, appUrl: APP_URL })
        ).catch(() => { /* best-effort */ });
      }
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

      // Fetch subscription's period end from Stripe (not invoice.period_end,
      // which refers to the invoicing period and can be in the past)
      let periodEnd: Date | null = null;
      if (sub.stripeSubscriptionId) {
        const stripeSubObj = await getStripe().subscriptions.retrieve(sub.stripeSubscriptionId);
        periodEnd = getSubscriptionPeriodEnd(stripeSubObj);
      }

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

      const subPeriodEnd = getSubscriptionPeriodEnd(stripeSub);

      await prisma.subscription.updateMany({
        where: { stripeCustomerId: customerId },
        data: {
          status,
          stripeSubscriptionId: stripeSub.id,
          ...(subPeriodEnd ? { currentPeriodEnd: subPeriodEnd } : {}),
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

      // Send payment-failed email (best-effort)
      const sub = await prisma.subscription.findUnique({
        where: { stripeCustomerId: customerId },
        select: { userId: true },
      });
      if (sub?.userId) {
        const user = await prisma.user.findUnique({ where: { id: sub.userId } });
        if (user?.email) {
          sendEmail(
            user.email,
            "Action required: your FormPilot payment failed",
            React.createElement(PaymentFailedEmail, { name: user.name ?? undefined, appUrl: APP_URL })
          ).catch(() => { /* best-effort */ });
        }
      }
      break;
    }

    default:
      // Log unhandled event types but always return 200 to avoid Stripe retries
      console.log(`[stripe-webhook] unhandled event type: ${event.type}`);
      break;
  }

  return NextResponse.json({ received: true });
}
