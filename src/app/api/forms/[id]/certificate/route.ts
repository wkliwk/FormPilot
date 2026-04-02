import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isProUser } from "@/lib/subscription";
import { generateCertificate } from "@/lib/pdf/certificate";
import type { FormField } from "@/lib/ai/analyze-form";

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
    select: {
      id: true,
      userId: true,
      title: true,
      category: true,
      status: true,
      fields: true,
      updatedAt: true,
    },
  });

  if (!form || form.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (form.status !== "COMPLETED") {
    return NextResponse.json({ error: "Form is not completed" }, { status: 400 });
  }

  const isPro = await isProUser(session.user.id);
  if (!isPro) {
    return NextResponse.json({ error: "Pro plan required" }, { status: 403 });
  }

  const fields = form.fields as unknown as FormField[];

  const pdfBytes = await generateCertificate({
    formId: form.id,
    userId: session.user.id,
    formTitle: form.title,
    category: form.category,
    completedAt: form.updatedAt,
    fields,
  });

  const safeTitle = form.title.replace(/[^a-z0-9]/gi, "_");

  return new NextResponse(new Uint8Array(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${safeTitle}_certificate.pdf"`,
    },
  });
}
