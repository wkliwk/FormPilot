export interface DemoField {
  id: string;
  label: string;
  type: "text" | "date" | "checkbox" | "email" | "tel" | "select";
  explanation: string;
  tip: string;
}

export interface DemoForm {
  slug: string;
  title: string;
  category: string;
  description: string;
  fields: DemoField[];
}

export const DEMO_FORMS: DemoForm[] = [
  {
    slug: "job-application",
    title: "Simple Job Application Form",
    category: "HR / Employment",
    description: "A standard new-hire onboarding form with personal details and employment information.",
    fields: [
      { id: "first_name", label: "First Name", type: "text", explanation: "Your legal first name as it appears on your government-issued ID. Use the name on your Social Security card — not a nickname.", tip: "Use your full legal name, not a preferred name or nickname." },
      { id: "last_name", label: "Last Name", type: "text", explanation: "Your family name or surname. If you recently changed your name, use your current legal last name that matches your SSN records.", tip: "Hyphenated names are fine — write them exactly as they appear on your ID." },
      { id: "date_of_birth", label: "Date of Birth", type: "date", explanation: "Your birthday in MM/DD/YYYY format. This is used to verify your identity and cannot be left blank on this form.", tip: "Double-check the year — a common mistake is typing the current year instead of your birth year." },
      { id: "email", label: "Email Address", type: "email", explanation: "A valid email address where your employer can send pay stubs, tax documents, and HR communications.", tip: "Avoid work email addresses that you might lose access to if you change jobs." },
      { id: "phone", label: "Phone Number", type: "tel", explanation: "Your primary contact number, including area code. Format: (555) 867-5309.", tip: "Enter digits only — parentheses and dashes are added automatically." },
      { id: "job_title", label: "Job Title / Position", type: "text", explanation: "Your official title as it appears in your offer letter. This determines your pay scale and benefits tier.", tip: "Use the exact title from your offer letter." },
      { id: "start_date", label: "Employment Start Date", type: "date", explanation: "The first official day of your employment. Used to calculate benefits eligibility and seniority.", tip: "If your start date changed, use the revised date from your updated offer letter." },
      { id: "full_time", label: "Full-Time Employee", type: "checkbox", explanation: "Check this box if you are hired as a full-time employee (typically 35+ hours/week).", tip: "Your classification affects which benefits package you are eligible for." },
    ],
  },
  {
    slug: "w4",
    title: "W-4 Employee Withholding Certificate",
    category: "Tax",
    description: "IRS Form W-4 determines how much federal income tax your employer withholds from your paycheck.",
    fields: [
      { id: "w4_first_name", label: "First name and middle initial", type: "text", explanation: "Your legal first name and middle initial as shown on your Social Security card. If your name changed due to marriage, update your SSN card first.", tip: "Include your middle initial — the IRS uses it to match your records." },
      { id: "w4_last_name", label: "Last name", type: "text", explanation: "Your last name as it appears on your Social Security card.", tip: "Must match your SSN records exactly." },
      { id: "w4_ssn", label: "Social Security number", type: "text", explanation: "Your 9-digit SSN (XXX-XX-XXXX). This links your withholding to your tax account. Never share this form with anyone other than your employer.", tip: "Find it on your Social Security card or previous W-2." },
      { id: "w4_address", label: "Address", type: "text", explanation: "Your current home address including street, apartment number if applicable.", tip: "Use the address where you file your tax return." },
      { id: "w4_city_state_zip", label: "City or town, state, and ZIP code", type: "text", explanation: "Complete your mailing address. This must match the address on your tax return.", tip: "Use two-letter state abbreviation (e.g., CA, NY, TX)." },
      { id: "w4_filing_status", label: "Filing status", type: "select", explanation: "Choose: Single/Married filing separately, Married filing jointly, or Head of household. This determines your tax bracket and standard deduction amount.", tip: "If married, filing jointly usually results in lower withholding. Head of household requires you to be unmarried and pay >50% of household costs." },
      { id: "w4_multiple_jobs", label: "Multiple jobs or spouse works", type: "checkbox", explanation: "Check this if you hold more than one job at a time, or if you're married filing jointly and your spouse also works. This ensures enough tax is withheld.", tip: "If both jobs pay similar amounts, check the box. For unequal pay, use the IRS Tax Withholding Estimator for a more accurate result." },
      { id: "w4_dependents", label: "Number of dependents", type: "text", explanation: "Claim $2,000 per qualifying child under 17, and $500 for other dependents. Multiply and enter the total dollar amount.", tip: "A qualifying child must live with you for more than half the year and be under 17 at year-end." },
      { id: "w4_other_income", label: "Other income (not from jobs)", type: "text", explanation: "Include interest, dividends, and retirement income you expect this year that won't have withholding. Enter the annual total.", tip: "Don't include income from a side job here — that goes in Step 2." },
      { id: "w4_deductions", label: "Deductions other than standard", type: "text", explanation: "If you plan to itemize deductions (mortgage interest, charitable donations, state taxes) and they exceed the standard deduction, enter the excess here.", tip: "2024 standard deduction: $14,600 (single), $29,200 (married filing jointly). Only enter the amount ABOVE this." },
      { id: "w4_extra_withholding", label: "Extra withholding per pay period", type: "text", explanation: "An additional flat dollar amount to withhold from each paycheck. Useful if you have income not subject to withholding (freelance, gig work).", tip: "If you owed tax last year, divide that amount by your number of pay periods to estimate." },
      { id: "w4_signature", label: "Employee signature", type: "text", explanation: "By signing, you certify under penalty of perjury that the information is correct. An unsigned W-4 is invalid.", tip: "Date the form on the day you actually sign it, not your start date." },
      { id: "w4_date", label: "Date", type: "date", explanation: "The date you sign the form. Must be on or before your first day of employment.", tip: "Use today's date." },
    ],
  },
  {
    slug: "i9",
    title: "I-9 Employment Eligibility Verification",
    category: "Immigration",
    description: "USCIS Form I-9 verifies your identity and authorization to work in the United States.",
    fields: [
      { id: "i9_last_name", label: "Last Name (Family Name)", type: "text", explanation: "Your current legal last name. If you've had other names, those go in a separate field.", tip: "Must match the name on your work authorization document." },
      { id: "i9_first_name", label: "First Name (Given Name)", type: "text", explanation: "Your legal first name as it appears on your identity documents.", tip: "Use the full name, not a shortened version." },
      { id: "i9_middle_initial", label: "Middle Initial", type: "text", explanation: "Your middle initial. Write N/A if you don't have a middle name.", tip: "If you have a middle name, use only the first letter." },
      { id: "i9_other_names", label: "Other Last Names Used (if any)", type: "text", explanation: "List any other last names you have used (maiden name, previous married names). Write N/A if none.", tip: "Include all previous legal last names to help your employer verify your documents." },
      { id: "i9_address", label: "Address (Street Number and Name)", type: "text", explanation: "Your current residential street address. PO boxes are not accepted.", tip: "Must be a physical address, not a mailing-only address." },
      { id: "i9_apt", label: "Apt. Number", type: "text", explanation: "Your apartment, suite, or unit number. Write N/A if not applicable.", tip: "Include the unit type (Apt, Suite, Unit) followed by the number." },
      { id: "i9_city", label: "City or Town", type: "text", explanation: "The city or town where you currently live.", tip: "Use the full city name, not abbreviations." },
      { id: "i9_state", label: "State", type: "text", explanation: "The US state where you currently reside. Use the two-letter abbreviation.", tip: "For territories, use: PR (Puerto Rico), GU (Guam), VI (US Virgin Islands)." },
      { id: "i9_zip", label: "ZIP Code", type: "text", explanation: "Your 5-digit or 9-digit ZIP code.", tip: "The 5-digit code is sufficient." },
      { id: "i9_dob", label: "Date of Birth", type: "date", explanation: "Your date of birth in MM/DD/YYYY format.", tip: "Must match your identity document." },
      { id: "i9_ssn", label: "U.S. Social Security Number", type: "text", explanation: "Your 9-digit SSN. This field is voluntary unless your employer participates in E-Verify.", tip: "If your employer uses E-Verify, you must provide your SSN." },
      { id: "i9_email", label: "Employee's Email Address", type: "email", explanation: "Optional. If provided, USCIS may contact you about your Form I-9.", tip: "Use a personal email you'll have access to long-term." },
      { id: "i9_phone", label: "Employee's Telephone Number", type: "tel", explanation: "Optional. A phone number where USCIS can reach you if needed.", tip: "Include area code." },
      { id: "i9_citizen_status", label: "Citizenship / Immigration Status", type: "select", explanation: "Select one: (1) US Citizen, (2) Noncitizen National, (3) Lawful Permanent Resident, (4) Noncitizen authorized to work. This determines which documents you need to present.", tip: "If you're a green card holder, select option 3 and enter your USCIS number or A-Number." },
      { id: "i9_signature", label: "Employee Signature", type: "text", explanation: "You must sign on or before your first day of work. Signing certifies that the information is true and correct.", tip: "Electronic signatures are accepted if your employer uses an electronic I-9 system." },
      { id: "i9_date", label: "Date (Employee Signature)", type: "date", explanation: "The date you sign Section 1. Must be no later than your first day of employment.", tip: "You may complete and sign Section 1 before your start date (e.g., at a new-hire orientation)." },
    ],
  },
];
