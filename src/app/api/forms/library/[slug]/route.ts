import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getLibraryForm } from "@/lib/library";
import { canUploadForm, incrementFormUsage } from "@/lib/subscription";
import { handleApiError } from "@/lib/api-error";

// POST /api/forms/library/[slug] — create a Form record from a library definition
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { slug } = await params;

  try {
    const libraryForm = await getLibraryForm(slug);
    if (!libraryForm) {
      return NextResponse.json({ error: "Library form not found" }, { status: 404 });
    }

    const quota = await canUploadForm(session.user.id);
    if (!quota.allowed) {
      return NextResponse.json(
        {
          error: "Form limit reached",
          formsUsed: quota.formsUsed,
          limit: quota.limit,
        },
        { status: 403 }
      );
    }

    const form = await prisma.form.create({
      data: {
        userId: session.user.id,
        title: libraryForm.title,
        sourceType: "PDF",
        fields: libraryForm.fields as unknown as Parameters<typeof prisma.form.create>[0]["data"]["fields"],
        category: libraryForm.category.toUpperCase().replace(/[\s\/]+/g, "_").replace(/[^A-Z0-9_]/g, ""),
        status: "ANALYZED",
      },
    });

    await incrementFormUsage(session.user.id);

    return NextResponse.json({ formId: form.id }, { status: 201 });
  } catch (err) {
    return handleApiError(err, `POST /api/forms/library/${slug}`);
  }
}
