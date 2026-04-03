import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) {
    return new NextResponse("<p>Invalid unsubscribe link.</p>", {
      status: 400,
      headers: { "Content-Type": "text/html" },
    });
  }

  if (!process.env.NEXTAUTH_SECRET) {
    return new NextResponse("<p>Server misconfiguration.</p>", {
      status: 500,
      headers: { "Content-Type": "text/html" },
    });
  }

  const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET);
  let userId: string;
  try {
    const { payload } = await jwtVerify(token, secret, { algorithms: ["HS256"] });
    if (!payload.userId || typeof payload.userId !== "string") {
      throw new Error("missing userId");
    }
    userId = payload.userId;
  } catch {
    return new NextResponse("<p>This unsubscribe link is invalid or has expired.</p>", {
      status: 400,
      headers: { "Content-Type": "text/html" },
    });
  }

  await prisma.user.update({
    where: { id: userId },
    data: { digestUnsubscribed: true },
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://getformpilot.com";
  return new NextResponse(
    `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>Unsubscribed — FormPilot</title>
<style>body{font-family:-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f8fafc}
.card{text-align:center;padding:40px;max-width:400px}
h1{color:#0f172a;font-size:1.5rem;margin-bottom:.75rem}
p{color:#475569;margin-bottom:1.5rem}
a{color:#2563eb;text-decoration:none}</style>
</head>
<body><div class="card">
<h1>You've been unsubscribed</h1>
<p>You won't receive weekly form digest emails from FormPilot anymore.</p>
<p><a href="${appUrl}/dashboard">Back to dashboard</a></p>
</div></body></html>`,
    { status: 200, headers: { "Content-Type": "text/html" } }
  );
}
