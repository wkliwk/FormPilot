import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SignJWT } from "jose";

const SAFE_TOP_LEVEL_KEYS = [
  "firstName", "lastName", "email", "phone", "dateOfBirth",
  "employerName", "jobTitle", "annualIncome",
];
const BLOCKED_KEYS = new Set(["ssn", "passportNumber", "driversLicense", "driversLicenseState", "taxId"]);

/** Extract only safe, non-sensitive fields from the raw profile data blob. */
function extractSafePayload(data: Record<string, unknown>): Record<string, unknown> {
  const safe: Record<string, unknown> = {};
  for (const key of SAFE_TOP_LEVEL_KEYS) {
    if (data[key] !== undefined && data[key] !== null && String(data[key]).trim()) {
      safe[key] = data[key];
    }
  }
  // Address is a nested object — include it if it exists, scrub any sensitive sub-keys
  if (data.address && typeof data.address === "object") {
    const addr = data.address as Record<string, unknown>;
    const safeAddr: Record<string, string> = {};
    for (const [k, v] of Object.entries(addr)) {
      if (!BLOCKED_KEYS.has(k) && v !== null && v !== undefined && String(v).trim()) {
        safeAddr[k] = String(v);
      }
    }
    if (Object.keys(safeAddr).length > 0) safe.address = safeAddr;
  }
  return safe;
}

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profile = await prisma.profile.findUnique({ where: { userId: session.user.id } });
  if (!profile) {
    return NextResponse.json({ error: "No profile found. Fill in your profile first." }, { status: 404 });
  }

  const safePayload = extractSafePayload(profile.data as Record<string, unknown>);
  if (Object.keys(safePayload).length === 0) {
    return NextResponse.json({ error: "Your profile is empty. Add some details first." }, { status: 400 });
  }

  const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET ?? "dev-secret");
  const token = await new SignJWT({ profile: safePayload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(secret);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://getformpilot.com";
  const importUrl = `${appUrl}/profile/import?token=${token}`;

  return NextResponse.json({ token, importUrl, fields: Object.keys(safePayload) });
}
