import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { buildCacheKey, lookupCacheEntries, storeCacheEntries } from "./field-cache";
import { detectCategory, CATEGORY_SYSTEM_PROMPTS, type FormCategory } from "./form-categories";

export type { FormCategory };

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
  category: FormCategory;
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

const FIELD_ANALYSIS_INSTRUCTIONS = `Analyze the form and extract all fillable fields.

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

/** Parse Claude response text, validate with Zod, overlay field cache, and attach category */
async function parseAndCacheAnalysis(responseText: string, category: FormCategory): Promise<FormAnalysis> {
  const jsonMatch = responseText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON found in AI response");

  let analysis: FormAnalysis;
  try {
    const parsed = JSON.parse(jsonMatch[0]);
    const validated = formAnalysisSchema.parse(parsed);
    analysis = { ...validated, category } as FormAnalysis;
  } catch (e) {
    throw new Error(`Failed to parse AI response: ${e instanceof Error ? e.message : "invalid JSON"}`);
  }

  // Overlay cached explanations and store new ones
  try {
    const cacheKeys = analysis.fields.map((f) => buildCacheKey(f.label, f.type));
    const cached = await lookupCacheEntries(cacheKeys);

    const misses: Array<{ cacheKey: string; data: { explanation: string; example: string; commonMistakes: string; profileKey: string | null } }> = [];

    analysis.fields = analysis.fields.map((field): FormField => {
      const key = buildCacheKey(field.label, field.type);
      const hit = cached.get(key);
      if (hit) {
        return {
          ...field,
          explanation: hit.explanation,
          example: hit.example,
          commonMistakes: hit.commonMistakes,
          ...(hit.profileKey ? { profileKey: hit.profileKey } : {}),
        };
      }
      misses.push({
        cacheKey: key,
        data: {
          explanation: field.explanation,
          example: field.example,
          commonMistakes: field.commonMistakes,
          profileKey: field.profileKey ?? null,
        },
      });
      return field;
    });

    const hitRate = cacheKeys.length > 0
      ? ((cacheKeys.length - misses.length) / cacheKeys.length * 100).toFixed(0)
      : "0";
    console.log(`[field-cache] ${cacheKeys.length} fields, ${cacheKeys.length - misses.length} hits (${hitRate}%)`);

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

  const message = await client.messages.create({
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
  });

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

/**
 * Analyze form fields from an image using Claude vision API.
 *
 * Full implementation lives on feat/form-category-detection (PR #57).
 * This stub exists so TypeScript can resolve the import and integration
 * tests can mock it with jest.mock(). Once PR #57 is merged, this stub
 * is replaced by the real multi-modal Claude vision call.
 *
 * @param base64 - Base64-encoded image data (output of preprocessImage)
 * @param mimeType - Image MIME type (image/jpeg | image/png | image/webp)
 * @param titleHint - Optional filename hint for category detection
 * @throws Error - Stub always throws; real impl added by PR #57
 */
export async function analyzeFormFieldsFromImage(
  _base64: string,
  _mimeType: string,
  _titleHint?: string
): Promise<FormAnalysis> {
  throw new Error(
    "analyzeFormFieldsFromImage is not yet implemented. This stub will be replaced by PR #57 (feat/form-category-detection)."
  );
}
