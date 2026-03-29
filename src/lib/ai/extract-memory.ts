import { prisma } from "@/lib/prisma";
import type { FormField } from "@/lib/ai/analyze-form";

// Sensitive labels — never store in memory
const SENSITIVE_LABELS = new Set([
  "ssn", "socialsecuritynumber", "passportnumber", "driverlicense", "driverslicense",
  "bankaccount", "routingnumber", "creditcard", "creditcardnumber", "taxid", "ein", "itin",
]);

// Field type taxonomy based on profileKey or label keywords
const FIELD_TYPE_MAP: Record<string, string> = {
  firstName: "name", lastName: "name", fullName: "name", name: "name",
  email: "email", emailAddress: "email",
  phone: "phone", phoneNumber: "phone", mobile: "phone", cellPhone: "phone",
  address: "address", streetAddress: "address", city: "address", state: "address",
  zipCode: "address", postalCode: "address", country: "address",
  employer: "employer", companyName: "employer", employerName: "employer", occupation: "employer",
  jobTitle: "employer", workAddress: "employer",
  passportNumber: "passport", passportIssuedDate: "passport", passportExpiry: "passport",
  nationality: "passport", countryOfBirth: "passport",
};

const LABEL_KEYWORD_TYPES: Array<[RegExp, string]> = [
  [/email/i, "email"],
  [/phone|mobile|cell|tel/i, "phone"],
  [/address|street|city|state|zip|postal|country/i, "address"],
  [/employer|company|organization|employer name|job title|occupation/i, "employer"],
  [/passport/i, "passport"],
  [/name/i, "name"],
];

function classifyFieldType(field: FormField): string {
  if (field.profileKey && FIELD_TYPE_MAP[field.profileKey]) {
    return FIELD_TYPE_MAP[field.profileKey];
  }
  for (const [pattern, type] of LABEL_KEYWORD_TYPES) {
    if (pattern.test(field.label)) return type;
  }
  return "custom";
}

function normalizeLabel(label: string): string {
  return label.toLowerCase().trim().replace(/[^a-z0-9]/g, "");
}

/**
 * Extract field→value pairs from a completed form and upsert them to FormMemory.
 * Sensitive fields are skipped. Called after a form reaches COMPLETED status.
 */
export async function extractMemoryFromForm(
  userId: string,
  formId: string,
  formTitle: string,
  fields: FormField[]
): Promise<number> {
  const filledFields = fields.filter(
    (f) => f.value && f.value.trim() && !SENSITIVE_LABELS.has(normalizeLabel(f.label))
  );

  if (filledFields.length === 0) return 0;

  let upserted = 0;
  for (const field of filledFields) {
    const label = normalizeLabel(field.label);
    const fieldType = classifyFieldType(field);

    await prisma.formMemory.upsert({
      where: { userId_label: { userId, label } },
      update: {
        value: field.value!.trim(),
        sourceFormId: formId,
        sourceTitle: formTitle,
        lastUsed: new Date(),
        fieldType,
      },
      create: {
        userId,
        label,
        fieldType,
        value: field.value!.trim(),
        confidence: 1.0,
        sourceFormId: formId,
        sourceTitle: formTitle,
      },
    });
    upserted++;
  }

  return upserted;
}
