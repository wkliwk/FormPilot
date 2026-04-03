import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { prisma } from "@/lib/prisma";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://getformpilot.com";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.redirect(`${APP_URL}/dashboard?verify=invalid`);
  }

  try {
    const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET ?? "");
    const { payload } = await jwtVerify(token, secret, { algorithms: ["HS256"] });

    if (payload.purpose !== "verify-email" || typeof payload.userId !== "string") {
      return NextResponse.redirect(`${APP_URL}/dashboard?verify=invalid`);
    }

    await prisma.user.update({
      where: { id: payload.userId },
      data: { emailVerified: new Date() },
    });

    return NextResponse.redirect(`${APP_URL}/dashboard?verify=success`);
  } catch {
    return NextResponse.redirect(`${APP_URL}/dashboard?verify=expired`);
  }
}
