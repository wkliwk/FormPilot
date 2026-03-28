import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const MIME_TYPES: Record<string, string> = {
  PDF: "application/pdf",
  IMAGE: "image/jpeg",
  WORD: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

export async function GET(
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
    select: { userId: true, fileBytes: true, sourceType: true, title: true },
  });

  if (!form || form.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!form.fileBytes) {
    return NextResponse.json({ error: "No file data" }, { status: 404 });
  }

  const contentType = MIME_TYPES[form.sourceType] ?? "application/octet-stream";

  return new NextResponse(form.fileBytes, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `inline; filename="${form.title ?? "document"}"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
