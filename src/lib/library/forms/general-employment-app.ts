import type { LibraryFormDefinition } from "@/lib/library";

const form: LibraryFormDefinition = {
  slug: "general-employment-app",
  title: "General Employment Application",
  category: "HR / Employment",
  description: "Standard job application form covering personal details, education, work history, and references.",
  estimatedMinutes: 20,
  fields: [
    { id: "gea-name", label: "Full legal name", type: "text", required: true, explanation: "Your full legal name as it appears on your ID.", example: "Marcus DeShawn Williams", commonMistakes: "Using a preferred or shortened name instead of your legal name.", profileKey: "firstName" },
    { id: "gea-phone", label: "Phone number", type: "text", required: true, explanation: "Your primary phone number including area code.", example: "404-555-0123", commonMistakes: "Forgetting the area code.", profileKey: "phone" },
    { id: "gea-email", label: "Email address", type: "email", required: true, explanation: "A professional email address you check regularly.", example: "marcus.williams@email.com", commonMistakes: "Using an unprofessional email address (e.g., coolkid2002@...) for a formal job application.", profileKey: "email" },
    { id: "gea-address", label: "Current home address", type: "text", required: true, explanation: "Your full current home address.", example: "222 Peachtree Street, Atlanta, GA 30303", commonMistakes: "Using a temporary address — employers may mail correspondence here.", profileKey: "address.street" },
    { id: "gea-position", label: "Position applied for", type: "text", required: true, explanation: "The specific job title you are applying for.", example: "Marketing Coordinator", commonMistakes: "Writing 'any position' — be specific, or your application may be overlooked." },
    { id: "gea-start-availability", label: "Date available to start", type: "date", required: false, explanation: "The earliest date you are available to begin work.", example: "2024-04-01", commonMistakes: "Entering today's date if you need notice period — be honest about your availability." },
    { id: "gea-employment-type", label: "Desired employment type", type: "select", required: false, explanation: "Whether you are looking for full-time, part-time, temporary, or contract work.", example: "Full-time", commonMistakes: "Selecting 'any' if the employer only hires for one type." },
    { id: "gea-us-authorized", label: "Authorised to work in the US?", type: "select", required: true, explanation: "Whether you are legally authorised to work in the United States.", example: "Yes", commonMistakes: "Answering without checking your visa status — answer accurately." },
    { id: "gea-edu-school", label: "Highest education — School name", type: "text", required: false, explanation: "The name of the last school or university you attended.", example: "Georgia State University", commonMistakes: "Abbreviating the school name — write it in full." },
    { id: "gea-edu-degree", label: "Highest education — Degree or diploma", type: "text", required: false, explanation: "The degree, diploma, or certificate you received.", example: "Bachelor of Business Administration", commonMistakes: "Writing only the abbreviation (e.g., 'BBA') without spelling it out." },
    { id: "gea-edu-year", label: "Highest education — Year graduated", type: "text", required: false, explanation: "The year you graduated or completed the programme.", example: "2019", commonMistakes: "Leaving blank if you did not graduate — employers typically prefer an explanation." },
    { id: "gea-employer1-name", label: "Most recent employer — Company name", type: "text", required: false, explanation: "The name of your most recent employer.", example: "ABC Marketing LLC", commonMistakes: "Using a department name instead of the company." },
    { id: "gea-employer1-title", label: "Most recent employer — Job title", type: "text", required: false, explanation: "Your official job title at your most recent employer.", example: "Marketing Assistant", commonMistakes: "Inflating your title — employers verify with HR." },
    { id: "gea-employer1-dates", label: "Most recent employer — Dates of employment", type: "text", required: false, explanation: "Start and end dates at your most recent employer.", example: "June 2020 – December 2023", commonMistakes: "Leaving gaps unaccounted for — be prepared to explain any gaps." },
    { id: "gea-employer1-reason", label: "Most recent employer — Reason for leaving", type: "text", required: false, explanation: "Brief reason why you left or are leaving your most recent role.", example: "Seeking career growth", commonMistakes: "Speaking negatively about a previous employer." },
    { id: "gea-ref1-name", label: "Reference #1 — Name and title", type: "text", required: false, explanation: "Name and job title of your first professional reference.", example: "Lisa Grant, Marketing Director", commonMistakes: "Using family members as professional references." },
    { id: "gea-ref1-phone", label: "Reference #1 — Phone", type: "text", required: false, explanation: "Phone number for your first reference.", example: "404-555-0456", commonMistakes: "Not informing your reference that they may be contacted." },
  ],
};

export default form;
