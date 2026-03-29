import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const MIME_TYPES: Record<string, string> = {
  PDF: "application/pdf",
  WORD: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

/** Detect image MIME type from magic bytes to avoid serving wrong content-type */
function detectImageMimeType(buf: Buffer): string {
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "image/png";
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46) return "image/webp";
  return "image/jpeg"; // fallback
}

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

  const buf = Buffer.from(form.fileBytes as Buffer);
  const contentType = form.sourceType === "IMAGE"
    ? detectImageMimeType(buf)
    : (MIME_TYPES[form.sourceType] ?? "application/octet-stream");

  return new NextResponse(buf, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `inline; filename="${form.title ?? "document"}"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
