import type { LibraryFormDefinition } from "@/lib/library";

const form: LibraryFormDefinition = {
  slug: "1040-schedule-a",
  title: "Schedule A — Itemized Deductions",
  category: "Tax",
  description: "Itemize deductions on your federal income tax return instead of taking the standard deduction.",
  estimatedMinutes: 20,
  fields: [
    { id: "scha-name", label: "Your name", type: "text", required: true, explanation: "Your name as shown on your Form 1040.", example: "Sarah L. Thompson", commonMistakes: "Using a different name than on your 1040.", profileKey: "firstName" },
    { id: "scha-ssn", label: "Social Security Number", type: "text", required: true, explanation: "Your SSN as shown on your Form 1040.", example: "456-78-9012", commonMistakes: "Transposing digits — double-check before submitting.", profileKey: "ssn" },
    { id: "scha-medical", label: "Medical and dental expenses (Line 1)", type: "number", required: false, explanation: "Total unreimbursed medical and dental expenses paid during the year. Only the amount exceeding 7.5% of your AGI is deductible.", example: "4500", commonMistakes: "Including expenses reimbursed by insurance or your HSA." },
    { id: "scha-agi", label: "Adjusted Gross Income (Line 2)", type: "number", required: true, explanation: "Your AGI from Form 1040, Line 11. Used to calculate the 7.5% threshold for medical deductions.", example: "80000", commonMistakes: "Using gross income instead of AGI." },
    { id: "scha-state-local-tax", label: "State and local income or sales taxes (Line 5a/5b)", type: "number", required: false, explanation: "State and local income taxes paid, OR sales taxes paid — whichever is greater. Combined SALT deduction is capped at $10,000.", example: "8000", commonMistakes: "Deducting both income and sales taxes — you must choose one." },
    { id: "scha-real-estate-tax", label: "Real estate taxes (Line 5b)", type: "number", required: false, explanation: "Property taxes paid on your home(s). Part of the $10,000 SALT cap.", example: "5500", commonMistakes: "Including fees or special assessments that are not deductible as taxes." },
    { id: "scha-home-mortgage-interest", label: "Home mortgage interest (Line 8a)", type: "number", required: false, explanation: "Mortgage interest reported on Form 1098. Deductible on up to $750,000 of mortgage debt (for loans after Dec 15, 2017).", example: "12000", commonMistakes: "Including principal payments — only interest is deductible." },
    { id: "scha-mortgage-insurance", label: "Mortgage insurance premiums (Line 8d)", type: "number", required: false, explanation: "Private mortgage insurance (PMI) premiums paid, if eligible.", example: "1200", commonMistakes: "Claiming this if your AGI exceeds the phase-out threshold — check eligibility." },
    { id: "scha-gifts-cash", label: "Gifts by cash or check (Line 11)", type: "number", required: false, explanation: "Total charitable contributions made by cash or check to qualified organisations.", example: "3000", commonMistakes: "Including donations to individuals, political campaigns, or non-qualified organisations." },
    { id: "scha-gifts-other", label: "Gifts other than by cash or check (Line 12)", type: "number", required: false, explanation: "Fair market value of non-cash donations (clothing, household items, stock, etc.). Items over $500 require Form 8283.", example: "800", commonMistakes: "Using original cost instead of fair market value for donated items." },
    { id: "scha-casualty-loss", label: "Casualty and theft losses (Line 15)", type: "number", required: false, explanation: "Losses from federally declared disasters only (post-2018). Must exceed 10% of AGI plus $100.", example: "0", commonMistakes: "Claiming non-disaster losses — personal theft and casualty losses are no longer deductible." },
    { id: "scha-other-deductions", label: "Other itemized deductions (Line 16)", type: "number", required: false, explanation: "Any other allowable deductions such as gambling losses up to gambling winnings.", example: "0", commonMistakes: "Including employee business expenses — these are generally not deductible for employees post-2018." },
  ],
};

export default form;
