import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }

  if (!process.env.NEXTAUTH_SECRET) {
    return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
  }
  const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET);
  try {
    const { payload } = await jwtVerify(token, secret, { algorithms: ["HS256"] });
    if (!payload.profile || typeof payload.profile !== "object") {
      return NextResponse.json({ error: "Invalid token" }, { status: 400 });
    }
    return NextResponse.json({ profile: payload.profile });
  } catch {
    return NextResponse.json({ error: "This link has expired or is invalid." }, { status: 400 });
  }
}
