import { NextResponse } from "next/server";
import { SignJWT } from "jose";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import VerificationEmail from "@/emails/VerificationEmail";
import * as React from "react";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://getformpilot.com";
const RATE_LIMIT_MAX = 3;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

export async function POST() {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const now = new Date();
  const windowStart = new Date(now.getTime() - RATE_LIMIT_WINDOW_MS);
  const key = `${userId}:verify_email`;

  // Check if already verified
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { emailVerified: true, name: true },
  });
  if (user?.emailVerified) {
    return NextResponse.json({ error: "Already verified" }, { status: 400 });
  }

  // Rate limit: 3 sends per hour
  const rateLimit = await prisma.rateLimit.upsert({
    where: { key },
    update: {
      count: { increment: 1 },
      windowStart: { set: windowStart },
      updatedAt: now,
    },
    create: { key, count: 1, windowStart: now },
  });

  // Reset window if stale
  if (rateLimit.windowStart < windowStart) {
    await prisma.rateLimit.update({
      where: { key },
      data: { count: 1, windowStart: now },
    });
  } else if (rateLimit.count > RATE_LIMIT_MAX) {
    return NextResponse.json(
      { error: "Too many requests. Please try again in an hour." },
      { status: 429 }
    );
  }

  // Generate signed JWT (24h expiry)
  const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET ?? "");
  const token = await new SignJWT({ userId, purpose: "verify-email" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("24h")
    .sign(secret);

  const verifyUrl = `${APP_URL}/api/auth/verify-email?token=${token}`;

  await sendEmail(
    session.user.email,
    "Verify your FormPilot email",
    React.createElement(VerificationEmail, {
      userName: user?.name ?? session.user.email,
      verifyUrl,
    })
  );

  return NextResponse.json({ ok: true });
}
