import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getStripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sub = await prisma.subscription.findUnique({
    where: { userId: session.user.id },
    select: { stripeCustomerId: true },
  });

  if (!sub?.stripeCustomerId) {
    return NextResponse.json({ invoices: [] });
  }

  const stripe = getStripe();
  const { data: invoices } = await stripe.invoices.list({
    customer: sub.stripeCustomerId,
    limit: 12,
    status: "paid",
  });

  return NextResponse.json({
    invoices: invoices.map((inv) => ({
      id: inv.id,
      date: inv.created * 1000,
      amount: inv.amount_paid,
      currency: inv.currency,
      pdfUrl: inv.invoice_pdf,
      status: inv.status,
    })),
  });
}
