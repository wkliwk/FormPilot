import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { jwtVerify } from "jose";
import { z } from "zod";

const bodySchema = z.object({ token: z.string().min(1).max(4096) });

// Per-user import rate limit: 5 imports/hour
const IMPORT_WINDOW_MS = 60 * 60_000;
const IMPORT_LIMIT = 5;
const importStore = new Map<string, { timestamps: number[] }>();

function checkImportRateLimit(userId: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const cutoff = now - IMPORT_WINDOW_MS;
  let entry = importStore.get(userId);
  if (!entry) { entry = { timestamps: [] }; importStore.set(userId, entry); }
  entry.timestamps = entry.timestamps.filter((t) => t > cutoff);
  if (entry.timestamps.length >= IMPORT_LIMIT) {
    const retryAfter = Math.ceil((entry.timestamps[0] + IMPORT_WINDOW_MS - now) / 1000);
    return { allowed: false, retryAfter: retryAfter > 0 ? retryAfter : 1 };
  }
  entry.timestamps.push(now);
  return { allowed: true };
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = checkImportRateLimit(session.user.id);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many imports. Try again later.", retryAfter: rl.retryAfter }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { token } = parsed.data;
  if (!process.env.NEXTAUTH_SECRET) {
    return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
  }
  const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET);

  let importedProfile: Record<string, unknown>;
  try {
    const { payload } = await jwtVerify(token, secret, { algorithms: ["HS256"] });
    if (!payload.profile || typeof payload.profile !== "object") {
      return NextResponse.json({ error: "Invalid token payload" }, { status: 400 });
    }
    importedProfile = payload.profile as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "This link has expired or is invalid. Ask for a new one." }, { status: 400 });
  }

  // Merge: only fill in fields the user hasn't already set
  const existing = await prisma.profile.findUnique({ where: { userId: session.user.id } });
  const existingData = (existing?.data ?? {}) as Record<string, unknown>;

  function deepMergeOnlyBlanks(target: Record<string, unknown>, source: Record<string, unknown>): Record<string, unknown> {
    const result = { ...target };
    for (const [key, val] of Object.entries(source)) {
      if (typeof val === "object" && val !== null && !Array.isArray(val)) {
        const existing = result[key];
        result[key] = deepMergeOnlyBlanks(
          (typeof existing === "object" && existing !== null ? existing : {}) as Record<string, unknown>,
          val as Record<string, unknown>
        );
      } else {
        // Only import if the field is blank/missing in the target
        // Use explicit null/undefined check to avoid overwriting valid falsy values (0, false)
        const current = result[key];
        if (current === null || current === undefined || String(current).trim() === "") {
          result[key] = val;
        }
      }
    }
    return result;
  }

  const merged = deepMergeOnlyBlanks(existingData, importedProfile);

  await prisma.profile.upsert({
    where: { userId: session.user.id },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    create: { userId: session.user.id, data: merged as any },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    update: { data: merged as any },
  });

  return NextResponse.json({ success: true });
}
