import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { nanoid } from "nanoid";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const form = await prisma.form.findUnique({
    where: { id },
    select: { id: true, userId: true, shareToken: true },
  });

  if (!form || form.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Return existing token if already shared
  const token = form.shareToken ?? nanoid(16);

  if (!form.shareToken) {
    await prisma.form.update({
      where: { id },
      data: { shareToken: token },
    });
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://getformpilot.com";
  return NextResponse.json({ url: `${baseUrl}/share/${token}` });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const form = await prisma.form.findUnique({
    where: { id },
    select: { userId: true },
  });

  if (!form || form.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.form.update({
    where: { id },
    data: { shareToken: null },
  });

  return NextResponse.json({ ok: true });
}
