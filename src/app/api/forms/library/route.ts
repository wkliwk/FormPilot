import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAllLibraryForms } from "@/lib/library";
import { handleApiError } from "@/lib/api-error";

// GET /api/forms/library — returns all library form metadata (no fields, lightweight)
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const forms = await getAllLibraryForms();
    const metadata = forms.map((f) => ({
      slug: f.slug,
      title: f.title,
      category: f.category,
      description: f.description,
      estimatedMinutes: f.estimatedMinutes,
      fieldCount: f.fields.length,
    }));
    return NextResponse.json({ forms: metadata });
  } catch (err) {
    return handleApiError(err, "GET /api/forms/library");
  }
}
