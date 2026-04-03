export interface SEOForm {
  slug: string;
  title: string;
  metaTitle: string;
  metaDescription: string;
  h1: string;
  description: string;
  painPoints: string[];
  whoNeeds: string;
  ctaText: string;
}

export const SEO_FORMS: SEOForm[] = [
  {
    slug: "w4",
    title: "W-4 Form",
    metaTitle: "W-4 Form Help — Fill Your W-4 with AI | FormPilot",
    metaDescription: "Confused by IRS Form W-4? FormPilot explains every field in plain English, auto-fills from your profile, and exports a completed PDF. Free to try.",
    h1: "W-4 Form Help — Fill Your W-4 with AI",
    description: "IRS Form W-4 (Employee's Withholding Certificate) tells your employer how much federal income tax to withhold from your paycheck. Getting it wrong means owing money at tax time or getting a smaller paycheck than necessary.",
    painPoints: [
      "The 'Multiple Jobs' worksheet is confusing — most people skip it and end up under-withholding",
      "Calculating dependent credits requires knowing the difference between 'qualifying child' and 'other dependent'",
      "The 'Deductions' section asks you to estimate itemized deductions before the year ends",
      "A new W-4 is needed every time your life changes — marriage, new job, new baby — and it's easy to forget",
    ],
    whoNeeds: "Every employee in the US fills out a W-4 when starting a new job, and should update it after major life events (marriage, divorce, new child, second job).",
    ctaText: "Upload your W-4",
  },
  {
    slug: "1040",
    title: "1040 Tax Return",
    metaTitle: "1040 Tax Return Help — File Your Federal Taxes with AI | FormPilot",
    metaDescription: "Form 1040 doesn't have to be intimidating. FormPilot reads your tax return, explains each line, and auto-fills from your profile. Free to start.",
    h1: "1040 Tax Return Help — File with Confidence",
    description: "IRS Form 1040 is the standard federal income tax return filed annually by US taxpayers. It calculates your total income, deductions, credits, and tax owed or refunded.",
    painPoints: [
      "Over 100 lines across schedules — knowing which ones apply to you is half the battle",
      "Schedule C (self-employment), Schedule D (capital gains), and Schedule E (rental income) each have their own complexity",
      "The standard vs. itemized deduction decision can cost you hundreds of dollars if chosen wrong",
      "Estimated tax payments, foreign tax credits, and education credits each have gotchas that trip up filers",
    ],
    whoNeeds: "Every US taxpayer with income above the filing threshold. That's roughly 150 million Americans each year.",
    ctaText: "Upload your 1040",
  },
  {
    slug: "i9",
    title: "I-9 Form",
    metaTitle: "I-9 Form Help — Verify Employment Eligibility with AI | FormPilot",
    metaDescription: "USCIS Form I-9 verifies you're authorized to work in the US. FormPilot explains every field, catches common mistakes, and helps you finish fast.",
    h1: "I-9 Form Help — Employment Eligibility Made Simple",
    description: "USCIS Form I-9 (Employment Eligibility Verification) is required for every new hire in the United States. It verifies your identity and authorization to work. Mistakes can delay your start date or trigger an audit for your employer.",
    painPoints: [
      "Section 1 must be completed by the employee on or before the first day of work — not after",
      "Document requirements (List A vs. List B + C) confuse most people — which IDs count?",
      "Non-citizens must provide specific document numbers (USCIS Number, I-94 Number, or Foreign Passport Number) that are hard to locate",
      "Employers face fines of $252-$2,507 per form for I-9 errors, creating pressure on both sides to get it right",
    ],
    whoNeeds: "Every person hired for employment in the United States, regardless of citizenship status. Both citizens and work-authorized non-citizens complete this form.",
    ctaText: "Upload your I-9",
  },
  {
    slug: "ds160",
    title: "DS-160 Visa Application",
    metaTitle: "DS-160 Help — Complete Your US Visa Application with AI | FormPilot",
    metaDescription: "The DS-160 visa application has 50+ fields and strict formatting rules. FormPilot explains each section and helps you avoid rejection-causing mistakes.",
    h1: "DS-160 Visa Application Help — Avoid Common Mistakes",
    description: "Form DS-160 (Online Nonimmigrant Visa Application) is required for most US visa types including tourist (B1/B2), student (F1), and work (H1B) visas. One mistake can lead to visa denial or delays.",
    painPoints: [
      "The form times out after 20 minutes of inactivity — losing all your progress",
      "Travel history, employment history, and education sections require exact dates that most people don't have memorized",
      "The 'Additional Contact Information' section asks for someone in your home country AND someone in the US — the US contact trips up most applicants",
      "Photo requirements (specific dimensions, white background, no glasses) cause more rejections than any content error",
    ],
    whoNeeds: "Anyone applying for a US nonimmigrant visa — tourists, students, temporary workers, exchange visitors, and treaty traders.",
    ctaText: "Upload your DS-160",
  },
  {
    slug: "w2",
    title: "W-2 Form",
    metaTitle: "W-2 Form Help — Understand Your Wage Statement with AI | FormPilot",
    metaDescription: "Can't make sense of your W-2? FormPilot breaks down every box — wages, withholding, benefits — in plain English so you can file your taxes confidently.",
    h1: "W-2 Form Help — Understand Every Box on Your W-2",
    description: "Form W-2 (Wage and Tax Statement) is issued by your employer and summarizes your annual earnings and tax withholdings. You need it to file your federal and state tax returns accurately.",
    painPoints: [
      "Box 12 codes (D, DD, W, etc.) are cryptic — each represents a different type of compensation or benefit",
      "Multiple W-2s from different employers must be combined correctly on your tax return",
      "Discrepancies between your W-2 and your pay stubs are common and must be resolved with your employer before filing",
      "State and local tax boxes (15-20) vary by state and can have multiple entries if you worked in different states",
    ],
    whoNeeds: "Every employee who earned wages in the US during the tax year. Employers must issue W-2s by January 31.",
    ctaText: "Upload your W-2",
  },
];

export function getSEOForm(slug: string): SEOForm | undefined {
  return SEO_FORMS.find((f) => f.slug === slug);
}
