import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "crypto";
import { prisma } from "@/lib/prisma";

const CRON_SECRET = process.env.CRON_SECRET ?? "";

function verifyToken(formId: string, userId: string, token: string): boolean {
  if (!CRON_SECRET) return false;
  const expected = createHmac("sha256", CRON_SECRET).update(`${formId}:${userId}`).digest("hex");
  // Constant-time compare to prevent timing attacks
  return expected.length === token.length &&
    Buffer.from(expected).every((b, i) => b === token.charCodeAt(i));
}

// GET /api/forms/[id]/dismiss?token=... — mark form as COMPLETED from re-engagement email
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const token = req.nextUrl.searchParams.get("token") ?? "";

  if (!token) {
    return new NextResponse("Missing token", { status: 400 });
  }

  const form = await prisma.form.findUnique({ where: { id } });
  if (!form) {
    return new NextResponse("Form not found", { status: 404 });
  }

  if (!verifyToken(form.id, form.userId, token)) {
    return new NextResponse("Invalid token", { status: 403 });
  }

  await prisma.form.update({
    where: { id },
    data: { status: "COMPLETED" },
  });

  // Redirect to dashboard with a success message
  return NextResponse.redirect(
    new URL("/dashboard?dismissed=1", req.url),
    { status: 302 }
  );
}
