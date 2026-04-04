import type { LibraryFormDefinition } from "@/lib/library";

const form: LibraryFormDefinition = {
  slug: "offer-letter-acceptance",
  title: "Job Offer Letter Acceptance",
  category: "HR / Employment",
  description: "Formally accept a job offer and confirm your start date, compensation, and terms.",
  estimatedMinutes: 5,
  fields: [
    { id: "ola-candidate-name", label: "Candidate full name", type: "text", required: true, explanation: "Your full legal name as it should appear on employment records.", example: "Priya Sharma", commonMistakes: "Using a nickname instead of your legal name.", profileKey: "firstName" },
    { id: "ola-candidate-email", label: "Candidate email address", type: "email", required: true, explanation: "Your personal email address where you can be reached.", example: "priya.sharma@email.com", commonMistakes: "Using a work email from your current employer.", profileKey: "email" },
    { id: "ola-candidate-phone", label: "Candidate phone number", type: "text", required: false, explanation: "Your direct phone number including area code.", example: "415-555-0199", commonMistakes: "Forgetting the area code.", profileKey: "phone" },
    { id: "ola-position", label: "Position / job title", type: "text", required: true, explanation: "The exact job title as stated in your offer letter.", example: "Senior Software Engineer", commonMistakes: "Using a shortened or informal version of the title." },
    { id: "ola-employer", label: "Employer / company name", type: "text", required: true, explanation: "The full legal name of the hiring company.", example: "Acme Corporation", commonMistakes: "Using a brand name instead of the legal entity name.", profileKey: "employerName" },
    { id: "ola-start-date", label: "Agreed start date", type: "date", required: true, explanation: "The start date you are confirming, as agreed with the employer.", example: "2024-03-04", commonMistakes: "Choosing a date different from what was discussed — confirm with HR first." },
    { id: "ola-salary", label: "Annual salary or hourly rate", type: "text", required: false, explanation: "The compensation amount as stated in the offer letter, for confirmation.", example: "$95,000 per year", commonMistakes: "Omitting the period (per year/per hour) — be specific." },
    { id: "ola-acceptance-date", label: "Date of acceptance", type: "date", required: true, explanation: "The date you are signing and returning this acceptance.", example: "2024-02-15", commonMistakes: "Using a future date — this should be today's date." },
  ],
};

export default form;
