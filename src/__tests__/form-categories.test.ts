/**
 * Tests for src/lib/ai/form-categories.ts
 *
 * Verifies keyword-based category detection is deterministic and covers all
 * supported categories, and that every category has a system prompt.
 */

import {
  detectCategory,
  CATEGORY_SYSTEM_PROMPTS,
  type FormCategory,
} from "@/lib/ai/form-categories";

// ---------------------------------------------------------------------------
// detectCategory
// ---------------------------------------------------------------------------

describe("detectCategory", () => {
  // TAX

  it("detects TAX from IRS form title", () => {
    expect(detectCategory("Form W-4 Employee's Withholding Certificate", [])).toBe("TAX");
  });

  it("detects TAX from field labels containing 'filing status'", () => {
    expect(detectCategory("Employee Form", ["Filing Status", "Deductions", "Name"])).toBe("TAX");
  });

  it("detects TAX from '1040' in title", () => {
    expect(detectCategory("US Individual Income Tax Return 1040", [])).toBe("TAX");
  });

  it("detects TAX from 'withholding' keyword", () => {
    expect(detectCategory("", ["Total Federal Income Tax Withholding"])).toBe("TAX");
  });

  it("detects TAX from 'EIN' in field labels", () => {
    expect(detectCategory("Tax Form", ["EIN", "Business Name"])).toBe("TAX");
  });

  // IMMIGRATION

  it("detects IMMIGRATION from USCIS form I-130 title", () => {
    expect(detectCategory("Form I-130 Petition for Alien Relative", [])).toBe("IMMIGRATION");
  });

  it("detects IMMIGRATION from 'A-Number' field label", () => {
    expect(detectCategory("Immigration Form", ["A-Number", "Country of Birth"])).toBe("IMMIGRATION");
  });

  it("detects IMMIGRATION from 'visa' keyword", () => {
    expect(detectCategory("Visa Application", [])).toBe("IMMIGRATION");
  });

  it("detects IMMIGRATION from 'USCIS' in title", () => {
    expect(detectCategory("USCIS Form I-485", [])).toBe("IMMIGRATION");
  });

  it("detects IMMIGRATION from 'port of entry' field", () => {
    expect(detectCategory("Travel Record", ["Port of Entry", "Date of Arrival"])).toBe("IMMIGRATION");
  });

  // LEGAL

  it("detects LEGAL from 'plaintiff' keyword", () => {
    expect(detectCategory("Civil Complaint", ["Plaintiff Name", "Defendant Name"])).toBe("LEGAL");
  });

  it("detects LEGAL from 'affidavit' in title", () => {
    expect(detectCategory("Affidavit of Support", [])).toBe("LEGAL");
  });

  it("detects LEGAL from 'notarize' field label", () => {
    expect(detectCategory("Document", ["Must Notarize Here", "Signature"])).toBe("LEGAL");
  });

  it("detects LEGAL from 'power of attorney' in title", () => {
    expect(detectCategory("Durable Power of Attorney", [])).toBe("LEGAL");
  });

  // HR_EMPLOYMENT

  it("detects HR_EMPLOYMENT from 'direct deposit' in labels", () => {
    expect(detectCategory("New Hire Paperwork", ["Direct Deposit Account", "Routing Number"])).toBe(
      "HR_EMPLOYMENT"
    );
  });

  it("detects HR_EMPLOYMENT from 'onboarding' in title", () => {
    expect(detectCategory("Employee Onboarding Form", [])).toBe("HR_EMPLOYMENT");
  });

  it("detects HR_EMPLOYMENT from 'emergency contact' field", () => {
    expect(detectCategory("", ["Emergency Contact Name", "Relationship"])).toBe("HR_EMPLOYMENT");
  });

  it("detects HR_EMPLOYMENT from 'payroll' keyword", () => {
    expect(detectCategory("", ["Payroll Department", "Salary"])).toBe("HR_EMPLOYMENT");
  });

  // HEALTHCARE

  it("detects HEALTHCARE from 'patient' in title", () => {
    expect(detectCategory("Patient Intake Form", [])).toBe("HEALTHCARE");
  });

  it("detects HEALTHCARE from 'HIPAA' keyword", () => {
    expect(detectCategory("", ["HIPAA Authorization"])).toBe("HEALTHCARE");
  });

  it("detects HEALTHCARE from 'medical history' label", () => {
    expect(detectCategory("Health Form", ["Medical History", "Current Medications"])).toBe(
      "HEALTHCARE"
    );
  });

  it("detects HEALTHCARE from 'diagnosis' keyword", () => {
    expect(detectCategory("Clinical Form", ["Primary Diagnosis", "ICD Code"])).toBe("HEALTHCARE");
  });

  // GENERAL fallback

  it("returns GENERAL for a scholarship application with no matching keywords", () => {
    expect(detectCategory("Scholarship Application Form", ["Applicant Name", "GPA", "Essay"])).toBe(
      "GENERAL"
    );
  });

  it("returns GENERAL for empty title and empty labels", () => {
    expect(detectCategory("", [])).toBe("GENERAL");
  });

  it("returns GENERAL for unrecognized form content", () => {
    expect(detectCategory("Feedback Survey", ["Rate your experience", "Comments"])).toBe("GENERAL");
  });

  // Case-insensitivity

  it("is case-insensitive for title", () => {
    expect(detectCategory("FORM W-4 WITHHOLDING", [])).toBe("TAX");
  });

  it("is case-insensitive for field labels", () => {
    expect(detectCategory("Form", ["FILING STATUS"])).toBe("TAX");
  });

  // Priority ordering: IMMIGRATION before TAX (W-4 appears in both keyword maps)

  it("prioritises IMMIGRATION over TAX when immigration keywords appear first in haystack", () => {
    const result = detectCategory("USCIS Immigration Form", ["W-4", "Filing Status"]);
    expect(result).toBe("IMMIGRATION");
  });
});

// ---------------------------------------------------------------------------
// CATEGORY_SYSTEM_PROMPTS
// ---------------------------------------------------------------------------

describe("CATEGORY_SYSTEM_PROMPTS", () => {
  const expectedCategories: FormCategory[] = [
    "TAX",
    "IMMIGRATION",
    "LEGAL",
    "HR_EMPLOYMENT",
    "HEALTHCARE",
    "GENERAL",
  ];

  it("has a prompt for every supported category", () => {
    for (const category of expectedCategories) {
      expect(CATEGORY_SYSTEM_PROMPTS[category]).toBeDefined();
      expect(typeof CATEGORY_SYSTEM_PROMPTS[category]).toBe("string");
    }
  });

  it("every prompt is non-empty", () => {
    for (const category of expectedCategories) {
      expect(CATEGORY_SYSTEM_PROMPTS[category].trim().length).toBeGreaterThan(0);
    }
  });

  it("each prompt contains domain-specific terminology", () => {
    expect(CATEGORY_SYSTEM_PROMPTS.TAX).toMatch(/IRS/i);
    expect(CATEGORY_SYSTEM_PROMPTS.IMMIGRATION).toMatch(/USCIS/i);
    expect(CATEGORY_SYSTEM_PROMPTS.LEGAL).toMatch(/notarization|plaintiff|defendant/i);
    expect(CATEGORY_SYSTEM_PROMPTS.HR_EMPLOYMENT).toMatch(/employment|W-4|I-9/i);
    expect(CATEGORY_SYSTEM_PROMPTS.HEALTHCARE).toMatch(/HIPAA/i);
  });

  it("all prompts are distinct from one another", () => {
    const prompts = expectedCategories.map((c) => CATEGORY_SYSTEM_PROMPTS[c]);
    const uniquePrompts = new Set(prompts);
    expect(uniquePrompts.size).toBe(expectedCategories.length);
  });
});
