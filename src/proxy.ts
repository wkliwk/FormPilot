import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

// Note: `export const runtime` is not supported in proxy.ts (throws in Next.js 16).
// Node.js is the default runtime (stable since Next.js 15.5) — no explicit export needed.

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const isOnDashboard = req.nextUrl.pathname.startsWith("/dashboard");

  if (isOnDashboard && !isLoggedIn) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
