import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { auth } from "@/lib/auth";
import { handleApiError } from "@/lib/api-error";

// ── Rate limit: 5 imports/hour per user (shared bucket with linkedin import) ──
const WINDOW_MS = 60 * 60_000;
const LIMIT = 5;
const userStore = new Map<string, { timestamps: number[] }>();

function checkLimit(userId: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const cutoff = now - WINDOW_MS;
  const entry = userStore.get(userId) ?? { timestamps: [] };
  entry.timestamps = entry.timestamps.filter((t) => t > cutoff);
  if (entry.timestamps.length >= LIMIT) {
    return { allowed: false, retryAfter: Math.ceil((entry.timestamps[0] + WINDOW_MS - now) / 1000) };
  }
  entry.timestamps.push(now);
  userStore.set(userId, entry);
  return { allowed: true };
}

// ── Anthropic singleton ───────────────────────────────────────────────────────
let _anthropic: Anthropic | null = null;
function getClient(): Anthropic {
  if (!_anthropic) {
    if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not set");
    _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return _anthropic;
}

const ID_EXTRACT_PROMPT = `You are extracting personal information from a government-issued ID document photo.

Identify the document type first (US Driver License, US Passport, International Passport, Other).
Then extract ONLY the fields you can read clearly.

Return ONLY valid JSON with these fields (omit any you cannot read clearly):
{
  "documentType": "US Driver License" | "US Passport" | "International Passport" | "Other",
  "firstName": string,
  "lastName": string,
  "dateOfBirth": string (YYYY-MM-DD if possible),
  "address": { "street": string, "city": string, "state": string, "zip": string, "country": string },
  "driverLicense": string (license number — only for driver's licenses),
  "passportNumber": string (only for passports)
}

Rules:
- Only extract fields you can clearly see and read
- Do NOT guess or infer values you cannot see
- dateOfBirth: format as YYYY-MM-DD if possible
- For driver's licenses: include driverLicense (the license number)
- For passports: include passportNumber
- Do NOT include ssn or any financial information
- Return ONLY valid JSON, no markdown, no prose`;

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = checkLimit(session.user.id);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Import limit reached. You can import up to 5 times per hour.", retryAfter: rl.retryAfter },
      { status: 429 }
    );
  }

  let image: string;
  let mimeType: string;

  try {
    const body = await req.json() as { image?: unknown; mimeType?: unknown };
    image = typeof body.image === "string" ? body.image : "";
    mimeType = typeof body.mimeType === "string" ? body.mimeType : "image/jpeg";
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!image) {
    return NextResponse.json({ error: "No image provided" }, { status: 400 });
  }

  const validMimeTypes = ["image/jpeg", "image/png", "image/webp"];
  if (!validMimeTypes.includes(mimeType)) {
    return NextResponse.json({ error: "Unsupported image format. Use JPEG, PNG, or WebP." }, { status: 400 });
  }

  // Reject suspiciously large images (> ~5MB base64)
  if (image.length > 7_000_000) {
    return NextResponse.json({ error: "Image is too large. Please use a smaller photo." }, { status: 400 });
  }

  try {
    const anthropic = getClient();

    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mimeType as "image/jpeg" | "image/png" | "image/webp",
                data: image,
              },
            },
            {
              type: "text",
              text: ID_EXTRACT_PROMPT,
            },
          ],
        },
      ],
    });

    // Image is NOT stored — processed and discarded here
    const block = response.content[0];
    if (block.type !== "text" || !block.text) {
      return NextResponse.json({ error: "Could not read ID document. Try a clearer photo." }, { status: 422 });
    }

    const text = block.text.trim();
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}") + 1;
    if (start === -1 || end === 0) {
      return NextResponse.json({ error: "Could not extract data from ID. Try a clearer, well-lit photo." }, { status: 422 });
    }

    const fields = JSON.parse(text.slice(start, end)) as Record<string, unknown>;
    const { documentType, ...profileFields } = fields;

    if (Object.keys(profileFields).length === 0) {
      return NextResponse.json(
        { error: "Could not read any fields from the ID. Try a clearer, front-facing photo in good lighting." },
        { status: 422 }
      );
    }

    // Return extracted fields + document type label for UI display
    // Sensitive fields (driverLicense, passportNumber) are passed back to the client
    // for review — they will be encrypted server-side when saved via POST /api/profile
    return NextResponse.json({ fields: profileFields, documentType: documentType ?? "ID Document" });
  } catch (err) {
    return handleApiError(err, "POST /api/profile/import-id");
  }
}
