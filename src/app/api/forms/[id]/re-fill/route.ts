import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { handleApiError } from "@/lib/api-error";
import { getClient } from "@/lib/ai/analyze-form";
import { log } from "@/lib/logger";
import { z } from "zod";
import type { FormField } from "@/lib/ai/analyze-form";

export const maxDuration = 60;

const bodySchema = z.object({
  sourceFormId: z.string().min(1),
});

const mappingSchema = z.array(
  z.object({
    newFieldId: z.string(),
    value: z.string().nullable(),
  })
);

const DATE_VERIFY_RE = /date|expir|year|current|today|period/i;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "sourceFormId is required" }, { status: 400 });
  }

  const { sourceFormId } = parsed.data;

  try {
    // Load both forms, verify ownership
    const [targetForm, sourceForm] = await Promise.all([
      prisma.form.findUnique({ where: { id } }),
      prisma.form.findUnique({ where: { id: sourceFormId } }),
    ]);

    if (!targetForm || targetForm.userId !== session.user.id) {
      return NextResponse.json({ error: "Target form not found" }, { status: 404 });
    }
    if (!sourceForm || sourceForm.userId !== session.user.id) {
      return NextResponse.json({ error: "Source form not found" }, { status: 404 });
    }

    const targetFields = targetForm.fields as unknown as FormField[];
    const sourceFields = sourceForm.fields as unknown as FormField[];

    // Build the old-form values: label → value (only filled fields)
    const sourceValues = sourceFields
      .filter((f) => f.value && String(f.value).trim())
      .map((f) => ({ label: f.label, value: f.value! }));

    if (sourceValues.length === 0) {
      return NextResponse.json({ error: "Source form has no filled values" }, { status: 400 });
    }

    // Build the new field list for Claude
    const newFieldList = targetFields.map((f) => ({
      id: f.id,
      label: f.label,
      type: f.type,
    }));

    const prompt = `You are a form field mapping assistant. A user wants to pre-fill a new form using answers from a previous form they completed.

Old form filled values (label → value):
${sourceValues.map((v) => `"${v.label}": "${v.value}"`).join("\n")}

New form fields to fill (id, label, type):
${newFieldList.map((f) => `id="${f.id}" label="${f.label}" type="${f.type}"`).join("\n")}

For each new field, find the best matching old value. A match is valid when the field labels describe the same information (e.g. "First Name" matches "Given Name"). Use your judgment for minor wording differences.

Return ONLY a valid JSON array (no markdown, no extra text) in this exact format:
[
  { "newFieldId": "<id>", "value": "<matched value or null if no match>" }
]

Include ALL new field IDs in the output. Set value to null when there is no reasonable match.`;

    const client = getClient();
    const completion = await client.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
      max_tokens: 2048,
    });

    const raw = completion.choices[0]?.message?.content ?? "[]";

    // Strip markdown fences if present
    const cleaned = raw
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    let mappings: Array<{ newFieldId: string; value: string | null }>;
    try {
      const parsed2 = mappingSchema.safeParse(JSON.parse(cleaned));
      if (!parsed2.success) {
        throw new Error("Invalid mapping response shape");
      }
      mappings = parsed2.data;
    } catch {
      log.warn("re-fill: failed to parse Claude mapping response", {
        route: "POST /api/forms/[id]/re-fill",
        raw: raw.slice(0, 500),
      });
      return NextResponse.json({ error: "AI mapping failed — try again" }, { status: 502 });
    }

    // Apply mappings to target fields
    const mappingMap = new Map(mappings.map((m) => [m.newFieldId, m.value]));
    const updatedFields = targetFields.map((f): FormField => {
      const mappedValue = mappingMap.get(f.id);
      if (mappedValue) {
        return {
          ...f,
          value: mappedValue,
          // Use 0.85 confidence for prior-fill matches — clearly sourced, not profile-guessed
          confidence: 0.85,
          matchedFrom: "prior_fill",
          fieldState: "pending",
        };
      }
      return f;
    });

    await prisma.form.update({
      where: { id },
      data: {
        fields: updatedFields as object[],
        filledData: Object.fromEntries(
          updatedFields.filter((f) => f.value).map((f) => [f.id, f.value!])
        ),
        status: "FILLING",
      },
    });

    const matchedCount = updatedFields.filter((f) => f.matchedFrom === "prior_fill").length;

    log.info("Form re-filled from prior submission", {
      route: "POST /api/forms/[id]/re-fill",
      targetFormId: id,
      sourceFormId,
      matchedCount,
      totalFields: targetFields.length,
    });

    return NextResponse.json({ fields: updatedFields, matchedCount });
  } catch (err) {
    return handleApiError(err, "POST /api/forms/[id]/re-fill");
  }
}
