import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getClient } from "@/lib/ai/analyze-form";
import { handleCorsPreFlight, withCors } from "@/lib/cors";
import { handleApiError } from "@/lib/api-error";
import { log } from "@/lib/logger";

const SUPPORTED_LANGUAGES = ["en", "es", "zh", "ko", "vi", "tl", "ar", "hi", "fr", "pt"] as const;

const LANGUAGE_NAMES: Record<string, string> = {
  es: "Spanish",
  zh: "Chinese Simplified",
  ko: "Korean",
  vi: "Vietnamese",
  tl: "Tagalog",
  ar: "Arabic",
  hi: "Hindi",
  fr: "French",
  pt: "Portuguese",
};

function buildLanguageInstruction(language?: string | null): string {
  if (!language || language === "en") return "";
  const name = LANGUAGE_NAMES[language];
  if (!name) return "";
  return `\n\nProvide the explanation, example, and commonMistakes fields in ${name}. Keep the field label, id, and type in English as they must match the original form.`;
}

interface WebField {
  id: string;
  label: string;
  type: string;
  tagName: string;
  placeholder: string;
  required: boolean;
  value: string;
  index: number;
}

export async function OPTIONS(req: NextRequest) {
  return handleCorsPreFlight(req);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return withCors(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      req
    );
  }

  const body = await req.json();
  const fields: WebField[] = body.fields;
  const language: string | undefined = typeof body.language === "string" ? body.language : undefined;

  if (!fields || fields.length === 0) {
    return withCors(
      NextResponse.json({ error: "No fields provided" }, { status: 400 }),
      req
    );
  }

  // Validate language if provided
  if (language && !(SUPPORTED_LANGUAGES as readonly string[]).includes(language)) {
    return withCors(
      NextResponse.json({ error: `Unsupported language. Supported: ${SUPPORTED_LANGUAGES.join(", ")}` }, { status: 400 }),
      req
    );
  }

  const start = Date.now();

  // Build a text representation of the form fields for Claude
  const fieldDescriptions = fields
    .map(
      (f) =>
        `- Field "${f.label}" (type: ${f.type}, id: ${f.id}${f.required ? ", required" : ""}${f.placeholder ? `, placeholder: "${f.placeholder}"` : ""})`
    )
    .join("\n");

  const langInstruction = buildLanguageInstruction(language);

  let analyzedFields: Array<Record<string, unknown>>;

  try {
    const client = getClient();
    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: `You are a form analysis expert. Analyze these web form fields and provide explanations.

For each field, provide:
1. A plain-language explanation of what information belongs there
2. A realistic example answer
3. Common mistakes people make

Return a JSON array matching this schema:
[
  {
    "id": "field_id",
    "label": "Field label",
    "type": "field type",
    "index": 0,
    "explanation": "Plain language explanation",
    "example": "Example answer",
    "commonMistakes": "What people often get wrong",
    "profileKey": "firstName or null",
    "value": null,
    "confidence": 0
  }
]

Profile keys available: firstName, lastName, email, phone, dateOfBirth, address.street, address.city, address.state, address.zip, address.country, ssn, passportNumber, employerName, jobTitle, annualIncome${langInstruction}

WEB FORM FIELDS:
${fieldDescriptions}`,
        },
      ],
    });

    const content = message.content[0];
    if (content.type !== "text") {
      return withCors(
        NextResponse.json({ error: "Unexpected AI response", code: "AI_PARSE_ERROR" }, { status: 500 }),
        req
      );
    }

    const jsonMatch = content.text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return withCors(
        NextResponse.json({ error: "Could not parse AI response", code: "AI_PARSE_ERROR" }, { status: 500 }),
        req
      );
    }

    analyzedFields = JSON.parse(jsonMatch[0]);
  } catch (err) {
    const errorResponse = handleApiError(err, "POST /api/forms/analyze-web");
    return withCors(errorResponse, req);
  }

  // Try to autofill from user profile
  try {
    const { prisma } = await import("@/lib/prisma");
    const profile = await prisma.profile.findUnique({
      where: { userId: session.user.id },
    });

    if (profile) {
      const profileData = profile.data as Record<string, unknown>;
      const flat = flattenProfile(profileData);

      for (const field of analyzedFields) {
        if (field.profileKey && flat[field.profileKey as string]) {
          field.value = flat[field.profileKey as string];
          field.confidence = 0.9;
        }
      }
    }
  } catch (err) {
    log.warn("Profile autofill failed, returning analysis without autofill", {
      route: "POST /api/forms/analyze-web",
      error: err instanceof Error ? err.message : String(err),
    });
  }

  log.info("Web form analyzed", {
    route: "POST /api/forms/analyze-web",
    durationMs: Date.now() - start,
    fieldCount: analyzedFields.length,
  });

  return withCors(NextResponse.json({ fields: analyzedFields }), req);
}

function flattenProfile(data: Record<string, unknown>, prefix = ""): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(data)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      Object.assign(result, flattenProfile(value as Record<string, unknown>, fullKey));
    } else if (value != null) {
      result[fullKey] = String(value);
    }
  }
  return result;
}
