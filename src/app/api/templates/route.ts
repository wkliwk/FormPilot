import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { handleApiError } from "@/lib/api-error";
import type { FormField } from "@/lib/ai/analyze-form";

// GET /api/templates — list user's templates
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const templates = await prisma.formTemplate.findMany({
      where: { userId: session.user.id, revokedAt: null },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        name: true,
        category: true,
        slug: true,
        visibility: true,
        usedCount: true,
        createdAt: true,
        updatedAt: true,
        fields: true,
      },
    });

    const result = templates.map((t) => ({
      ...t,
      fieldCount: (t.fields as unknown as FormField[]).length,
    }));

    return NextResponse.json(result);
  } catch (err) {
    return handleApiError(err, "GET /api/templates");
  }
}

// POST /api/templates — kept for backward compat (prefer POST /api/forms/:id/template)
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json() as { formId?: string; name?: string };
  const { formId, name } = body;

  if (!formId || !name?.trim()) {
    return NextResponse.json({ error: "formId and name are required" }, { status: 400 });
  }

  // Delegate to the form-specific template endpoint logic
  const res = await fetch(`${process.env.NEXTAUTH_URL ?? ""}/api/forms/${formId}/template`, {
    method: "POST",
    headers: { Cookie: req.headers.get("cookie") ?? "" },
  });

  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
