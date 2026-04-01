import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { translateFieldExplanations } from "@/lib/ai/analyze-form";
import { checkRateLimit } from "@/lib/rate-limit";

export const maxDuration = 60;
import { handleApiError } from "@/lib/api-error";
import { log } from "@/lib/logger";
import type { FormField } from "@/lib/ai/analyze-form";

const SUPPORTED_LANGUAGES = ["en", "es", "zh", "zh-Hans", "zh-Hant", "yue", "ko", "vi", "tl", "ar", "hi", "fr", "pt"] as const;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimit = checkRateLimit(session.user.id);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      {
        status: 429,
        headers: { "Retry-After": String(rateLimit.retryAfter) },
      }
    );
  }

  const lang = req.nextUrl.searchParams.get("lang");

  if (!lang || !(SUPPORTED_LANGUAGES as readonly string[]).includes(lang)) {
    return NextResponse.json(
      { error: `Invalid or missing lang. Supported: ${SUPPORTED_LANGUAGES.join(", ")}` },
      { status: 400 }
    );
  }

  const { id } = await params;
  const form = await prisma.form.findUnique({ where: { id } });

  if (!form || form.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const start = Date.now();

  const existingFields = form.fields as unknown as FormField[];

  try {
    // Use translateFieldExplanations instead of full re-analysis — it preserves
    // all existing field properties (value, fieldState, confidence, profileKey,
    // id, etc.) and only translates explanation/example/commonMistakes.
    const updatedFields = await translateFieldExplanations(existingFields, lang);

    await prisma.form.update({
      where: { id },
      data: {
        fields: updatedFields as object,
        language: lang,
      },
    });

    log.info("Form re-explained", {
      route: "POST /api/forms/[id]/re-explain",
      durationMs: Date.now() - start,
      language: lang,
      fieldCount: updatedFields.length,
    });

    return NextResponse.json({ fields: updatedFields, language: lang });
  } catch (err) {
    return handleApiError(err, "POST /api/forms/[id]/re-explain");
  }
}
