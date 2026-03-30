import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { handleApiError } from "@/lib/api-error";

// POST /api/templates/[id]/use — create a new form from a template
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const template = await prisma.formTemplate.findUnique({ where: { id } });

    if (!template || template.revokedAt) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    // Create a new form from the template (skip analysis — template already has AI explanations)
    const [form] = await prisma.$transaction([
      prisma.form.create({
        data: {
          userId: session.user.id,
          title: template.name,
          sourceType: "PDF", // Template-derived forms are treated as generic PDF
          fields: template.fields as Parameters<typeof prisma.form.create>[0]["data"]["fields"],
          category: template.category,
          status: "ANALYZED",
        },
      }),
      prisma.formTemplate.update({
        where: { id },
        data: { usedCount: { increment: 1 } },
      }),
    ]);

    return NextResponse.json({ formId: form.id }, { status: 201 });
  } catch (err) {
    return handleApiError(err, "POST /api/templates/[id]/use");
  }
}
