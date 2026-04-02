import { NextRequest, NextResponse } from "next/server";

/** Sets the fp_ref cookie so the referral code survives OAuth redirect. */
export async function POST(req: NextRequest) {
  const { ref } = await req.json().catch(() => ({}));
  const res = NextResponse.json({ ok: true });
  if (ref && typeof ref === "string" && /^[a-z0-9]{8}$/i.test(ref)) {
    res.cookies.set("fp_ref", ref, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });
  }
  return res;
}
