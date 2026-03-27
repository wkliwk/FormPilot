import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

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

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const fields: WebField[] = body.fields;

  if (!fields || fields.length === 0) {
    return NextResponse.json({ error: "No fields provided" }, { status: 400 });
  }

  // Build a text representation of the form fields for Claude
  const fieldDescriptions = fields
    .map(
      (f) =>
        `- Field "${f.label}" (type: ${f.type}, id: ${f.id}${f.required ? ", required" : ""}${f.placeholder ? `, placeholder: "${f.placeholder}"` : ""})`
    )
    .join("\n");

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

Profile keys available: firstName, lastName, email, phone, dateOfBirth, address.street, address.city, address.state, address.zip, address.country, ssn, passportNumber, employerName, jobTitle, annualIncome

WEB FORM FIELDS:
${fieldDescriptions}`,
      },
    ],
  });

  const content = message.content[0];
  if (content.type !== "text") {
    return NextResponse.json({ error: "Unexpected AI response" }, { status: 500 });
  }

  const jsonMatch = content.text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    return NextResponse.json({ error: "Could not parse AI response" }, { status: 500 });
  }

  const analyzedFields = JSON.parse(jsonMatch[0]);

  // Try to autofill from user profile
  const { prisma } = await import("@/lib/prisma");
  const profile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
  });

  if (profile) {
    const profileData = profile.data as Record<string, unknown>;
    const flat = flattenProfile(profileData);

    for (const field of analyzedFields) {
      if (field.profileKey && flat[field.profileKey]) {
        field.value = flat[field.profileKey];
        field.confidence = 0.9;
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
