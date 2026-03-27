import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { buildCacheKey, lookupCacheEntries, storeCacheEntries } from "./field-cache";
import { withRetry } from "./retry";
import { detectCategory, CATEGORY_SYSTEM_PROMPTS } from "./form-categories";

// Shared Anthropic client singleton
let _client: Anthropic | null = null;
export function getClient(): Anthropic {
  if (!_client) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY is not set");
    }
    _client = new Anthropic();
  }
  return _client;
}

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
}

export interface FormAnalysis {
  title: string;
  description: string;
  fields: FormField[];
  estimatedMinutes: number;
  category?: string;
}

// Zod schemas for validating AI responses
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

Return a JSON object matching this schema:
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

/** Parse and validate the AI JSON response, then overlay/store cache entries. */
async function parseAndCacheAnalysis(
  responseText: string,
  language?: string | null
): Promise<FormAnalysis> {
  const jsonMatch = responseText.match(/\{[\s\S]*\}/);
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

  // Detect category from raw text before sending to Claude.
  const category = detectCategory(truncatedText, []);
  const categoryPrompt = CATEGORY_SYSTEM_PROMPTS[category];
  const fullPrompt = `${categoryPrompt}\n\n${BASE_ANALYSIS_PROMPT}${langInstruction}\n\nFORM CONTENT:\n${truncatedText}`;

  const message = await withRetry(
    () => client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      messages: [{
        role: "user",
        content: fullPrompt,
      }],
    }),
    "analyzeFormFields"
  );

  const content = message.content[0];
  if (content.type !== "text") throw new Error("Unexpected response type");
  const analysis = await parseAndCacheAnalysis(content.text, language);
  analysis.category = category;
  return analysis;
}

export async function analyzeFormFieldsFromImage(
  base64: string,
  mimeType: string,
  titleHint?: string,
  language?: string | null
): Promise<FormAnalysis> {
  const client = getClient();
  const langInstruction = buildLanguageInstruction(language);

  const message = await withRetry(
    () => client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      messages: [{
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: mimeType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
              data: base64,
            },
          },
          {
            type: "text",
            text: `${BASE_ANALYSIS_PROMPT}${langInstruction}\n\nLook at the form image above and extract all fillable fields you can identify.`,
          },
        ],
      }],
    }),
    "analyzeFormFieldsFromImage"
  );

  const content = message.content[0];
  if (content.type !== "text") throw new Error("Unexpected response type");
  return parseAndCacheAnalysis(content.text, language);
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

  const message = await withRetry(
    () => client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      messages: [
        {
          role: "user",
          content: `You are filling out a form on behalf of the user. Use their profile data to fill as many fields as possible. For fields the profile cannot fill, you may use the history suggestions provided.

USER PROFILE:
${JSON.stringify(safeProfile, null, 2)}${historySectionText}

FORM FIELDS:
${JSON.stringify(fields.map((f) => ({ id: f.id, label: f.label, type: f.type, profileKey: f.profileKey })), null, 2)}

Return a JSON array of { id, value, confidence } for each field you can fill.
confidence is 0.0–1.0 (1.0 = exact match from profile, 0.5 = inferred/transformed, 0.0 = cannot fill).
For fields filled from history suggestions, use confidence 0.6.
Only include fields with confidence > 0.`,
        },
      ],
    }),
    "autofillFields"
  );

  const content = message.content[0];
  if (content.type !== "text") throw new Error("Unexpected response type");

  const jsonMatch = content.text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return fields;

  let fills: Array<{ id: string; value: string; confidence: number }>;
  try {
    const parsed = JSON.parse(jsonMatch[0]);
    fills = autofillResponseSchema.parse(parsed);
  } catch {
    return fields;
  }

  const fillMap = new Map(fills.map((f) => [f.id, f]));

  let result = fields.map((field) => {
    const fill = fillMap.get(field.id);
    if (fill) {
      return { ...field, value: fill.value, confidence: fill.confidence, fieldState: "pending" as FieldState };
    }
    return field;
  });

  // Direct-fill sensitive fields without AI (exact profile match only)
  result = result.map((field) => {
    if (field.profileKey && SENSITIVE_KEYS.has(field.profileKey) && profile[field.profileKey] && !field.value) {
      return { ...field, value: profile[field.profileKey], confidence: 1.0 };
    }
    return field;
  });

  return result;
}

