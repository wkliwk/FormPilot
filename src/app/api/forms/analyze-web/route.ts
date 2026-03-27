import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { getClient } from "@/lib/ai/analyze-form";
import { prisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// Input schema
// ---------------------------------------------------------------------------

const WebFieldSchema = z.object({
  id: z.string().max(100),
  label: z.string().max(200),
  type: z.string().max(50),
  tagName: z.string().max(50),
  placeholder: z.string().max(500),
  required: z.boolean(),
  value: z.string().max(1000),
  index: z.number().int().nonnegative(),
});

const RequestBodySchema = z.object({
  fields: z
    .array(WebFieldSchema)
    .min(1, "At least one field is required")
    .max(100, "A maximum of 100 fields is allowed per request"),
});

// ---------------------------------------------------------------------------
// Sanitization
// ---------------------------------------------------------------------------

// Strip patterns commonly used in prompt injection attacks:
// - HTML/XML tags that can confuse instruction parsing
// - Instruction delimiter sequences (###, ---, ===, ```)
// - Role-switching keywords (system:, assistant:, user:)
// - Zero-width / invisible Unicode characters
// - Common jailbreak phrases
const PROMPT_INJECTION_PATTERN =
  /(<\/?[a-z][^>]*>|#\{.*?\}|\[\[.*?\]\]|system:|assistant:|user:|ignore previous|ignore all|disregard|you are now|act as|jailbreak|```[\s\S]*?```|#{3,}|-{3,}|={3,}|\u200b|\u200c|\u200d|\ufeff)/gi;

function sanitize(value: string): string {
  return value.replace(PROMPT_INJECTION_PATTERN, " ").trim();
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Parse and validate request body
  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parseResult = RequestBodySchema.safeParse(rawBody);
  if (!parseResult.success) {
    return NextResponse.json(
      {
        error: "Invalid request",
        details: parseResult.error.flatten().fieldErrors,
      },
      { status: 400 }
    );
  }

  const { fields } = parseResult.data;

  // Sanitize user-controlled strings before interpolating into the Claude prompt
  const sanitizedFields = fields.map((f) => ({
    ...f,
    id: sanitize(f.id),
    label: sanitize(f.label),
    placeholder: sanitize(f.placeholder),
  }));

  // Build a text representation of the form fields for Claude
  const fieldDescriptions = sanitizedFields
    .map(
      (f) =>
        `- Field "${f.label}" (type: ${f.type}, id: ${f.id}${f.required ? ", required" : ""}${f.placeholder ? `, placeholder: "${f.placeholder}"` : ""})`
    )
    .join("\n");

  const client = getClient();

  let message: Awaited<ReturnType<typeof client.messages.create>>;
  try {
    message = await client.messages.create({
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

Profile keys available: firstName, lastName, email, phone, dateOfBirth, address.street, address.city, address.state, address.zip, address.country, ssn, passportNumber, employerName, jobTitle, annualIncome

WEB FORM FIELDS:
${fieldDescriptions}`,
        },
      ],
    });
  } catch (err) {
    console.error("[analyze-web] Claude API error:", err);
    return NextResponse.json({ error: "AI service error" }, { status: 502 });
  }

  const content = message.content[0];
  if (content.type !== "text") {
    return NextResponse.json({ error: "Unexpected AI response" }, { status: 500 });
  }

  const jsonMatch = content.text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    return NextResponse.json({ error: "Could not parse AI response" }, { status: 500 });
  }

  let analyzedFields: unknown[];
  try {
    analyzedFields = JSON.parse(jsonMatch[0]) as unknown[];
  } catch {
    return NextResponse.json({ error: "Could not parse AI response" }, { status: 500 });
  }

  // Try to autofill from user profile
  const profile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
  });

  if (profile) {
    const profileData = profile.data as Record<string, unknown>;
    const flat = flattenProfile(profileData);

    for (const field of analyzedFields) {
      const f = field as Record<string, unknown>;
      if (typeof f.profileKey === "string" && flat[f.profileKey]) {
        f.value = flat[f.profileKey];
        f.confidence = 0.9;
      }
    }
  }

  return NextResponse.json({ fields: analyzedFields });
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
