import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Minimum floor so new products don't show "Join 0 people"
const SOCIAL_PROOF_FLOOR = 47;

export async function GET() {
  const count = await prisma.subscription.count({
    where: { status: "ACTIVE" },
  });
  return NextResponse.json({ proCount: Math.max(count, SOCIAL_PROOF_FLOOR) });
}
