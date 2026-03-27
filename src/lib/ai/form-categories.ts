/**
 * Form category detection and category-specific system prompts.
 *
 * Detection is purely heuristic (keyword-based) — no AI call needed,
 * which keeps it fast, deterministic, and zero-cost.
 */

export type FormCategory =
  | "TAX"
  | "IMMIGRATION"
  | "LEGAL"
  | "HR_EMPLOYMENT"
  | "HEALTHCARE"
  | "GENERAL";

// ---------------------------------------------------------------------------
// Keyword maps — order matters: more specific categories check first
// ---------------------------------------------------------------------------

const CATEGORY_KEYWORDS: Array<{ category: FormCategory; keywords: string[] }> = [
  {
    category: "IMMIGRATION",
    keywords: [
      "i-130",
      "i-485",
      "i-765",
      "i-131",
      "i-751",
      "i-864",
      "visa",
      "petition",
      "beneficiary",
      "a-number",
      "alien registration",
      "uscis",
      "country of birth",
      "port of entry",
      "class of admission",
      "citizenship and immigration",
      "department of homeland security",
      "naturalization",
      "green card",
      "adjustment of status",
    ],
  },
  {
    category: "TAX",
    keywords: [
      "1040",
      "w-2",
      "w-4",
      "1099",
      "filing status",
      "agi",
      "adjusted gross income",
      "deduction",
      "withholding",
      "ein",
      "employer identification number",
      "tax return",
      "irs",
      "internal revenue service",
      "taxable income",
      "federal income tax",
      "schedule",
      "itemized deduction",
      "standard deduction",
      "tax liability",
    ],
  },
  {
    category: "HEALTHCARE",
    keywords: [
      "patient",
      "insurance",
      "provider",
      "diagnosis",
      "hipaa",
      "medical history",
      "prescription",
      "physician",
      "hospital",
      "clinic",
      "treatment",
      "medication",
      "date of last visit",
      "primary care",
      "health plan",
      "policyholder",
      "copay",
      "deductible",
      "referral",
    ],
  },
  {
    category: "LEGAL",
    keywords: [
      "plaintiff",
      "defendant",
      "jurisdiction",
      "notarize",
      "affidavit",
      "court",
      "notary",
      "sworn",
      "hereby declare",
      "under penalty of perjury",
      "legal description",
      "grantor",
      "grantee",
      "witnesseth",
      "power of attorney",
      "deed",
      "agreement between",
      "parties hereto",
    ],
  },
  {
    category: "HR_EMPLOYMENT",
    keywords: [
      "employer",
      "onboarding",
      "direct deposit",
      "emergency contact",
      "w-4",
      "i-9",
      "employee",
      "human resources",
      "department",
      "salary",
      "position title",
      "job title",
      "start date",
      "employment type",
      "full-time",
      "part-time",
      "benefits",
      "payroll",
    ],
  },
];

// ---------------------------------------------------------------------------
// Category-specific system prompts
// ---------------------------------------------------------------------------

export const CATEGORY_SYSTEM_PROMPTS: Record<FormCategory, string> = {
  TAX: `You are a tax preparation expert with deep knowledge of IRS forms and instructions. When explaining fields:
- Reference the relevant IRS publication or instruction (e.g., "Per IRS Publication 17...").
- For Filing Status fields, explain all eligibility criteria: Single, Married Filing Jointly, Married Filing Separately, Head of Household, and Qualifying Surviving Spouse.
- For income fields, clarify which income types are included vs. excluded (wages, self-employment, capital gains, etc.).
- For deduction fields, explain when itemizing beats the standard deduction.
- Use proper IRS terminology: AGI, MAGI, EIN, ITIN, W-2, 1099, Schedule C, etc.
- Flag fields that commonly trigger IRS notices or delays if filled incorrectly.`,

  IMMIGRATION: `You are an immigration forms expert with deep knowledge of USCIS forms and procedures. When explaining fields:
- Reference the relevant USCIS instruction page or Part number (e.g., "Per USCIS instructions for Part 2...").
- For date fields, always specify USCIS's required format: MM/DD/YYYY.
- Clarify legal terminology: A-Number, EAD, I-94, Class of Admission, Priority Date, Receipt Notice, RFE.
- Flag fields that commonly cause Requests for Evidence (RFEs) if filled incorrectly.
- Distinguish petitioner vs. beneficiary fields clearly.
- Explain USCIS fee requirements where applicable.
- Highlight fields where incorrect answers could have serious legal consequences.`,

  LEGAL: `You are a legal forms expert with knowledge of contract law and court procedures. When explaining fields:
- Use precise legal terminology: plaintiff, defendant, jurisdiction, venue, notarization, affidavit, declarant.
- For signature fields, clarify whether notarization or witnessing is required and what that entails.
- Explain the legal significance of each field — what obligations it creates or waives.
- Note deadlines or statutes of limitations where relevant.
- Flag fields where incorrect or incomplete answers could affect legal enforceability.
- For court forms, clarify which court division or department typically handles them.`,

  HR_EMPLOYMENT: `You are an HR and employment law expert. When explaining fields:
- Reference applicable federal and state employment law where relevant (FLSA, ADA, FMLA, Title VII).
- For I-9 fields, clarify acceptable document categories and List A/B/C distinctions.
- For W-4 fields, explain the impact on take-home pay and year-end tax liability.
- For direct deposit fields, explain the difference between checking and savings account routing.
- For benefits elections, explain enrollment windows and default coverage implications.
- Flag fields with legal compliance requirements (e.g., fields that cannot discriminate under EEO law).`,

  HEALTHCARE: `You are a healthcare and medical forms expert with knowledge of HIPAA and health insurance. When explaining fields:
- Reference HIPAA privacy rules where relevant to data fields.
- For insurance fields, explain the difference between primary and secondary insurance, policyholder vs. insured.
- For medical history fields, explain what level of detail providers typically need.
- For diagnosis or procedure codes, clarify ICD-10 or CPT code requirements.
- For consent fields, explain what rights are granted or waived.
- Flag fields that are required for insurance pre-authorization or billing.`,

  GENERAL: `You are a form-filling expert who helps users understand and complete forms accurately. When explaining fields:
- Use plain, jargon-free language accessible to anyone.
- Provide clear, realistic examples for every field.
- Explain why the information is being requested and how it will be used.
- Note when information must match exactly what appears on official documents (e.g., government ID).
- Flag fields that are commonly skipped or misunderstood.`,
};

// ---------------------------------------------------------------------------
// Detection function
// ---------------------------------------------------------------------------

/**
 * Detect form category from title and field labels using keyword matching.
 *
 * Runs synchronously — no AI call, no I/O. O(n) in total keyword count.
 * Returns "GENERAL" when no category-specific keywords are found.
 */
export function detectCategory(
  title: string,
  fieldLabels: string[]
): FormCategory {
  const haystack = [title, ...fieldLabels]
    .join(" ")
    .toLowerCase();

  for (const { category, keywords } of CATEGORY_KEYWORDS) {
    for (const keyword of keywords) {
      if (haystack.includes(keyword.toLowerCase())) {
        return category;
      }
    }
  }

  return "GENERAL";
}
