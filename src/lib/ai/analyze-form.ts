import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

export interface FormField {
  id: string;
  label: string;
  type: string;
  required: boolean;
  explanation: string;     // Plain-language explanation of what this field means
  example: string;         // Example answer
  commonMistakes: string;  // What people often get wrong
  profileKey?: string;     // Key in user profile to autofill from
  value?: string;          // Filled value
  confidence?: number;     // 0–1 autofill confidence
}

export interface FormAnalysis {
  title: string;
  description: string;
  fields: FormField[];
  estimatedMinutes: number;
}

export async function analyzeFormFields(rawText: string): Promise<FormAnalysis> {
  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: `You are a form analysis expert. Analyze the following form and extract all fillable fields.

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
      "profileKey": "firstName" // or null if not auto-fillable
    }
  ],
  "estimatedMinutes": 5
}

FORM CONTENT:
${rawText}`,
      },
    ],
  });

  const content = message.content[0];
  if (content.type !== "text") throw new Error("Unexpected response type");

  const jsonMatch = content.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON found in response");

  return JSON.parse(jsonMatch[0]) as FormAnalysis;
}

export async function autofillFields(
  fields: FormField[],
  profile: Record<string, string>
): Promise<FormField[]> {
  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    messages: [
      {
        role: "user",
        content: `You are filling out a form on behalf of the user. Use their profile data to fill as many fields as possible.

USER PROFILE:
${JSON.stringify(profile, null, 2)}

FORM FIELDS:
${JSON.stringify(fields.map((f) => ({ id: f.id, label: f.label, type: f.type, profileKey: f.profileKey })), null, 2)}

Return a JSON array of { id, value, confidence } for each field you can fill.
confidence is 0.0–1.0 (1.0 = exact match from profile, 0.5 = inferred/transformed, 0.0 = cannot fill).
Only include fields with confidence > 0.`,
      },
    ],
  });

  const content = message.content[0];
  if (content.type !== "text") throw new Error("Unexpected response type");

  const jsonMatch = content.text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return fields;

  const fills: Array<{ id: string; value: string; confidence: number }> = JSON.parse(jsonMatch[0]);
  const fillMap = new Map(fills.map((f) => [f.id, f]));

  return fields.map((field) => {
    const fill = fillMap.get(field.id);
    if (fill) {
      return { ...field, value: fill.value, confidence: fill.confidence };
    }
    return field;
  });
}
