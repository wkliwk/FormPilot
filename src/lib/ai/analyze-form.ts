import Groq from "groq-sdk";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { buildCacheKey, lookupCacheEntries, storeCacheEntries } from "./field-cache";
import { withRetry } from "./retry";
import { detectCategory, CATEGORY_SYSTEM_PROMPTS } from "./form-categories";

// Shared Groq client singleton
let _client: Groq | null = null;
export function getClient(): Groq {
  if (!_client) {
    if (!process.env.GROQ_API_KEY) {
      throw new Error("GROQ_API_KEY is not set");
    }
    _client = new Groq({ apiKey: process.env.GROQ_API_KEY });
  }
  return _client;
}

// Shared Anthropic client singleton (used for vision/image analysis)
let _anthropicClient: Anthropic | null = null;
function getAnthropicClient(): Anthropic {
  if (!_anthropicClient) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY is not set");
    }
    _anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return _anthropicClient;
}

const MODEL = "llama-3.3-70b-versatile";

// Sensitive profile keys that must never be sent to external APIs
const SENSITIVE_KEYS = new Set([
  "ssn",
  "passportNumber",
  "driverLicense",
  "bankAccount",
  "routingNumber",
  "creditCard",
]);

export type FieldState = "pending" | "accepted" | "rejected";

/** Page coordinates for a form field, expressed as 0–1 fractions of the page dimensions. */
export interface FieldCoordinates {
  x: number;
  y: number;
  w: number;
  h: number;
  page: number;
}

export interface FormField {
  id: string;
  label: string;
  type: string;
  required: boolean;
  explanation: string;
  example: string;
  commonMistakes: string;
  whereToFind?: string;
  profileKey?: string;
  value?: string;
  confidence?: number;
  fieldState?: FieldState;
  /** Optional bounding box from PDF analysis (0–1 fractions of page size). */
  coordinates?: FieldCoordinates;
}

export interface FormAnalysis {
  title: string;
  description: string;
  fields: FormField[];
  estimatedMinutes: number;
  category?: string;
}

// Zod schemas for validating AI responses
const coordinatesSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  w: z.number().min(0).max(1),
  h: z.number().min(0).max(1),
  page: z.number().int().min(1).default(1),
}).optional();

const formAnalysisSchema = z.object({
  title: z.string(),
  description: z.string(),
  fields: z.array(z.object({
    id: z.string(),
    label: z.string(),
    type: z.string(),
    required: z.boolean(),
    explanation: z.string(),
    example: z.string(),
    commonMistakes: z.string(),
    profileKey: z.string().nullable().optional(),
    coordinates: coordinatesSchema,
  })),
  estimatedMinutes: z.number(),
});

const autofillResponseSchema = z.array(z.object({
  id: z.string(),
  value: z.string(),
  confidence: z.number().min(0).max(1),
}));

/** Strip sensitive fields from profile before sending to AI */
export function stripSensitiveFields(profile: Record<string, string>): Record<string, string> {
  const safe: Record<string, string> = {};
  for (const [key, value] of Object.entries(profile)) {
    if (!SENSITIVE_KEYS.has(key)) {
      safe[key] = value;
    }
  }
  return safe;
}

const MAX_TEXT_LENGTH = 50_000;

/** Map of ISO 639-1 codes to language names used in the prompt. */
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

/** Returns the language instruction suffix when language is non-English, or empty string. */
function buildLanguageInstruction(language?: string | null): string {
  if (!language || language === "en") return "";
  const name = LANGUAGE_NAMES[language];
  if (!name) return "";
  return `\n\nProvide the explanation, example, and commonMistakes fields in ${name}. Keep the field label, id, and type in English as they must match the original form.`;
}

const BASE_ANALYSIS_PROMPT = `You are a form analysis expert. Analyze the following form and extract all fillable fields.

For each field, provide:
1. A plain-language explanation of what information belongs there
2. A realistic example answer
3. Common mistakes people make
4. The profile data key that could auto-fill it (if applicable)

Profile keys available: firstName, lastName, email, phone, dateOfBirth, address.street, address.city, address.state, address.zip, address.country, ssn (last 4 only), passportNumber, employerName, jobTitle, annualIncome

Return ONLY a valid JSON object (no markdown fences, no extra text) matching this schema:
{
  "title": "Form title",
  "description": "What this form is for in 1-2 sentences",
  "fields": [
    {
      "id": "unique_snake_case_id",
      "label": "Field label as shown on form",
      "type": "text|date|number|select|checkbox|signature",
      "required": true,
      "explanation": "Plain language explanation",
      "example": "Example answer",
      "commonMistakes": "What people often get wrong",
      "profileKey": "firstName"
    }
  ],
  "estimatedMinutes": 5
}`;

/** Prompt for image-based analysis — same as base but also requests bounding box coordinates. */
const IMAGE_ANALYSIS_PROMPT = `You are a form analysis expert. Look at the form image and extract all fillable fields.

For each field, provide:
1. A plain-language explanation of what information belongs there
2. A realistic example answer
3. Common mistakes people make
4. The profile data key that could auto-fill it (if applicable)
5. The bounding box of the fillable input area (NOT the label) as fractions of the image dimensions

Profile keys available: firstName, lastName, email, phone, dateOfBirth, address.street, address.city, address.state, address.zip, address.country, ssn (last 4 only), passportNumber, employerName, jobTitle, annualIncome

IMPORTANT for coordinates: measure the blank input area where the user writes, not the label text.
- x: left edge of input / image width (0.0 to 1.0)
- y: top edge of input / image height (0.0 to 1.0)
- w: input width / image width (0.0 to 1.0)
- h: input height / image height (0.0 to 1.0)
- page: always 1 for single-page images

Return ONLY a valid JSON object (no markdown fences, no extra text) matching this schema:
{
  "title": "Form title",
  "description": "What this form is for in 1-2 sentences",
  "fields": [
    {
      "id": "unique_snake_case_id",
      "label": "Field label as shown on form",
      "type": "text|date|number|select|checkbox|signature",
      "required": true,
      "explanation": "Plain language explanation",
      "example": "Example answer",
      "commonMistakes": "What people often get wrong",
      "profileKey": "firstName",
      "coordinates": { "x": 0.12, "y": 0.08, "w": 0.45, "h": 0.03, "page": 1 }
    }
  ],
  "estimatedMinutes": 5
}`;

/** Parse and validate the AI JSON response, then overlay/store cache entries. */
async function parseAndCacheAnalysis(
  responseText: string,
  language?: string | null
): Promise<FormAnalysis> {
  // Strip markdown code fences if present
  let cleaned = responseText;
  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) cleaned = fenceMatch[1];

  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON found in AI response");

  let analysis: FormAnalysis;
  try {
    const parsed = JSON.parse(jsonMatch[0]);
    analysis = formAnalysisSchema.parse(parsed) as FormAnalysis;
  } catch (e) {
    throw new Error(`Failed to parse AI response: ${e instanceof Error ? e.message : "invalid JSON"}`);
  }

  // Overlay cached explanations and store new ones (language-aware cache keys)
  try {
    const cacheKeys = analysis.fields.map((f) => buildCacheKey(f.label, f.type, language));
    const cached = await lookupCacheEntries(cacheKeys);

    const misses: Array<{ cacheKey: string; data: { explanation: string; example: string; commonMistakes: string; whereToFind: string | null; profileKey: string | null } }> = [];

    analysis.fields = analysis.fields.map((field): FormField => {
      const key = buildCacheKey(field.label, field.type, language);
      const hit = cached.get(key);
      if (hit) {
        return {
          ...field,
          explanation: hit.explanation,
          example: hit.example,
          commonMistakes: hit.commonMistakes,
          ...(hit.whereToFind ? { whereToFind: hit.whereToFind } : {}),
          ...(hit.profileKey ? { profileKey: hit.profileKey } : {}),
        };
      }
      misses.push({
        cacheKey: key,
        data: {
          explanation: field.explanation,
          example: field.example,
          commonMistakes: field.commonMistakes,
          whereToFind: field.whereToFind ?? null,
          profileKey: field.profileKey ?? null,
        },
      });
      return field;
    });

    const hitRate = cacheKeys.length > 0
      ? ((cacheKeys.length - misses.length) / cacheKeys.length * 100).toFixed(0)
      : "0";
    const langTag = language && language !== "en" ? ` [${language}]` : "";
    console.log(`[field-cache${langTag}] ${cacheKeys.length} fields, ${cacheKeys.length - misses.length} hits (${hitRate}%)`);

    if (misses.length > 0) {
      storeCacheEntries(misses).catch((err) => {
        console.error("[field-cache] Failed to store cache entries:", err);
      });
    }
  } catch (cacheErr) {
    console.error("[field-cache] Cache lookup failed, proceeding without cache:", cacheErr);
  }

  return analysis;
}

export async function analyzeFormFields(
  rawText: string,
  language?: string | null
): Promise<FormAnalysis> {
  const client = getClient();
  const truncatedText = rawText.slice(0, MAX_TEXT_LENGTH);
  const langInstruction = buildLanguageInstruction(language);

  // Detect category from raw text before sending to AI.
  const category = detectCategory(truncatedText, []);
  const categoryPrompt = CATEGORY_SYSTEM_PROMPTS[category];
  const fullPrompt = `${categoryPrompt}\n\n${BASE_ANALYSIS_PROMPT}${langInstruction}\n\nFORM CONTENT:\n${truncatedText}`;

  const completion = await withRetry(
    () => client.chat.completions.create({
      model: MODEL,
      max_tokens: 4096,
      messages: [{ role: "user", content: fullPrompt }],
      temperature: 0.1,
    }),
    "analyzeFormFields"
  );

  const text = completion.choices[0]?.message?.content;
  if (!text) throw new Error("Empty response from AI");
  const analysis = await parseAndCacheAnalysis(text, language);
  analysis.category = category;
  return analysis;
}

/** Analyze a form image using Claude (Anthropic) vision — primary path. */
async function analyzeImageWithClaude(
  base64: string,
  mimeType: string,
  titleHint: string | undefined,
  langInstruction: string
): Promise<string> {
  const anthropic = getAnthropicClient();
  const response = await withRetry(
    () =>
      anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 4096,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: mimeType as "image/jpeg" | "image/png" | "image/webp" | "image/gif",
                  data: base64,
                },
              },
              {
                type: "text",
                text: `${IMAGE_ANALYSIS_PROMPT}${langInstruction}${titleHint ? `\n\nThe form title may be: ${titleHint}` : ""}`,
              },
            ],
          },
        ],
      }),
    "analyzeImageWithClaude"
  );
  const block = response.content[0];
  if (block.type !== "text" || !block.text) throw new Error("Empty response from Claude");
  return block.text;
}

/** Analyze a form image using Groq vision — fallback path. */
async function analyzeImageWithGroq(
  base64: string,
  mimeType: string,
  titleHint: string | undefined,
  langInstruction: string
): Promise<string> {
  const client = getClient();
  const completion = await withRetry(
    () =>
      client.chat.completions.create({
        model: "llama-3.2-11b-vision-preview",
        max_tokens: 4096,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: { url: `data:${mimeType};base64,${base64}` },
              },
              {
                type: "text",
                text: `${IMAGE_ANALYSIS_PROMPT}${langInstruction}${titleHint ? `\n\nThe form title may be: ${titleHint}` : ""}`,
              },
            ],
          },
        ],
        temperature: 0.1,
      }),
    "analyzeImageWithGroq"
  );
  const text = completion.choices[0]?.message?.content;
  if (!text) throw new Error("Empty response from Groq vision");
  return text;
}

export async function analyzeFormFieldsFromImage(
  base64: string,
  mimeType: string,
  titleHint?: string,
  language?: string | null
): Promise<FormAnalysis> {
  const langInstruction = buildLanguageInstruction(language);

  // Primary: Claude Haiku (reliable vision)
  // Fallback: Groq vision (cost-saving, less reliable)
  let responseText: string;
  try {
    responseText = await analyzeImageWithClaude(base64, mimeType, titleHint, langInstruction);
  } catch (primaryErr) {
    console.warn("[image-analysis] Claude vision failed, trying Groq fallback:", primaryErr instanceof Error ? primaryErr.message : primaryErr);
    try {
      responseText = await analyzeImageWithGroq(base64, mimeType, titleHint, langInstruction);
    } catch (fallbackErr) {
      console.error("[image-analysis] Both vision models failed. Claude:", primaryErr instanceof Error ? primaryErr.message : primaryErr, "Groq:", fallbackErr instanceof Error ? fallbackErr.message : fallbackErr);
      throw new Error("Image analysis failed. Please try again or upload a clearer image.");
    }
  }

  return parseAndCacheAnalysis(responseText, language);
}

export interface HistorySuggestion {
  fieldId: string;
  value: string;
  source: string; // Source form title
}

export async function autofillFields(
  fields: FormField[],
  profile: Record<string, string>,
  historicalSuggestions?: HistorySuggestion[]
): Promise<FormField[]> {
  const client = getClient();

  // Strip sensitive fields before sending to AI
  const safeProfile = stripSensitiveFields(profile);

  const historySectionText =
    historicalSuggestions && historicalSuggestions.length > 0
      ? `\n\nHISTORY SUGGESTIONS (from user's past forms — use these when profile cannot fill a field, but prefer profile data for identity fields):\n${JSON.stringify(
          historicalSuggestions.map((s) => ({
            fieldId: s.fieldId,
            value: s.value,
            source: s.source,
          })),
          null,
          2
        )}`
      : "";

  const prompt = `You are filling out a form on behalf of the user. Use their profile data to fill as many fields as possible. For fields the profile cannot fill, you may use the history suggestions provided.

USER PROFILE:
${JSON.stringify(safeProfile, null, 2)}${historySectionText}

FORM FIELDS:
${JSON.stringify(fields.map((f) => ({ id: f.id, label: f.label, type: f.type, profileKey: f.profileKey })), null, 2)}

Return ONLY a valid JSON array (no markdown fences, no extra text) of { id, value, confidence } for each field you can fill.
confidence is 0.0–1.0 (1.0 = exact match from profile, 0.5 = inferred/transformed, 0.0 = cannot fill).
For fields filled from history suggestions, use confidence 0.6.
Only include fields with confidence > 0.`;

  const completion = await withRetry(
    () => client.chat.completions.create({
      model: MODEL,
      max_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
    }),
    "autofillFields"
  );

  const responseText = completion.choices[0]?.message?.content;
  if (!responseText) return fields;

  // Strip markdown fences if present
  let cleaned = responseText;
  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) cleaned = fenceMatch[1];

  const jsonMatch = cleaned.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return fields;

  let fills: Array<{ id: string; value: string; confidence: number }>;
  try {
    const parsed = JSON.parse(jsonMatch[0]);
    fills = autofillResponseSchema.parse(parsed);
  } catch {
    return fields;
  }

  const fillMap = new Map(fills.map((f) => [f.id, f]));

  let updatedFields = fields.map((field) => {
    const fill = fillMap.get(field.id);
    if (fill) {
      return { ...field, value: fill.value, confidence: fill.confidence, fieldState: "pending" as FieldState };
    }
    return field;
  });

  // Direct-fill sensitive fields without AI (exact profile match only)
  updatedFields = updatedFields.map((field) => {
    if (field.profileKey && SENSITIVE_KEYS.has(field.profileKey) && profile[field.profileKey] && !field.value) {
      return { ...field, value: profile[field.profileKey], confidence: 1.0 };
    }
    return field;
  });

  return updatedFields;
}
