import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { callTextAI } from "@/lib/ai/provider-chain";
import { handleApiError } from "@/lib/api-error";
import type { FormField } from "@/lib/ai/analyze-form";

export const maxDuration = 30;

// GET /api/forms/[id]/overview — generate or return cached form overview
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const form = await prisma.form.findUnique({
      where: { id },
      select: { userId: true, title: true, category: true, fields: true, overviewData: true },
    });

    if (!form || form.userId !== session.user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Return cached overview if available
    if (form.overviewData) {
      return NextResponse.json(form.overviewData);
    }

    // Generate overview from field labels + title + category
    const fields = form.fields as unknown as FormField[];
    const fieldLabels = fields.slice(0, 30).map((f) => f.label).join(", ");

    const prompt = `You are a form expert. Given this form's title and fields, generate a concise overview.

Form title: "${form.title}"
Category: ${form.category ?? "General"}
Fields (sample): ${fieldLabels}

Return a JSON object with:
- "purpose": 1-2 sentence description of what this form is for
- "whoFills": who typically fills this form (e.g. "Employee", "Taxpayer", "Visa applicant")
- "whatYouNeed": array of 3-5 items the user should have ready (e.g. ["Social Security Number", "Current address", "Employer details"])
- "estimatedMinutes": estimated minutes to complete (integer)
- "warnings": array of 0-2 important warnings (e.g. ["This form is time-sensitive — submit before April 15"])

Return only valid JSON, no prose.`;

    const text = await callTextAI(prompt, "form-overview", 300);
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}") + 1;

    if (start === -1 || end === 0) {
      return NextResponse.json({ error: "Failed to generate overview" }, { status: 500 });
    }

    const overview = JSON.parse(text.slice(start, end));

    // Cache in DB
    await prisma.form.update({
      where: { id },
      data: { overviewData: overview },
    });

    return NextResponse.json(overview);
  } catch (err) {
    return handleApiError(err, "GET /api/forms/[id]/overview");
  }
}
