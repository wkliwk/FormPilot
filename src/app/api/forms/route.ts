import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const PAGE_SIZE = 20;

// GET /api/forms?cursor=<formId>&limit=20
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cursor = req.nextUrl.searchParams.get("cursor");
  const limit = Math.min(
    parseInt(req.nextUrl.searchParams.get("limit") ?? String(PAGE_SIZE), 10),
    100
  );

  const forms = await prisma.form.findMany({
    where: { userId: session.user.id! },
    orderBy: { createdAt: "desc" },
    take: limit + 1, // fetch one extra to determine hasMore
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: {
      id: true,
      title: true,
      status: true,
      sourceType: true,
      category: true,
      fields: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  const hasMore = forms.length > limit;
  const page = hasMore ? forms.slice(0, limit) : forms;

  const items = page.map((f) => {
    const fields = f.fields as Array<{ value?: string }>;
    const totalFields = fields.length;
    const filledCount = fields.filter((field) => field.value && String(field.value).trim()).length;
    return {
      id: f.id,
      title: f.title,
      status: f.status,
      sourceType: f.sourceType,
      category: f.category ?? null,
      fieldCount: totalFields,
      completionPercent: totalFields > 0 ? Math.round((filledCount / totalFields) * 100) : 0,
      createdAt: f.createdAt,
      updatedAt: f.updatedAt,
    };
  });

  return NextResponse.json({ items, hasMore, nextCursor: hasMore ? page[page.length - 1].id : null });
}
