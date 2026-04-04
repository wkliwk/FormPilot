import type { LibraryFormDefinition } from "@/lib/library";

const form: LibraryFormDefinition = {
  slug: "rental-application",
  title: "Rental Application",
  category: "Housing",
  description: "Apply to rent a residential property — personal details, employment, rental history, and references.",
  estimatedMinutes: 15,
  fields: [
    { id: "ra-name", label: "Full legal name", type: "text", required: true, explanation: "Your full name exactly as it appears on your government ID.", example: "James Okafor", commonMistakes: "Using a nickname or omitting a middle name that appears on your ID.", profileKey: "firstName" },
    { id: "ra-dob", label: "Date of birth", type: "date", required: true, explanation: "Used for identity verification and credit check authorisation.", example: "1988-07-14", commonMistakes: "Using the wrong date format — enter as YYYY-MM-DD.", profileKey: "dateOfBirth" },
    { id: "ra-phone", label: "Phone number", type: "text", required: true, explanation: "A reliable phone number where the landlord can reach you.", example: "718-555-0145", commonMistakes: "Forgetting the area code.", profileKey: "phone" },
    { id: "ra-email", label: "Email address", type: "email", required: true, explanation: "Your primary email address.", example: "james.okafor@email.com", commonMistakes: "Using a temporary or shared email.", profileKey: "email" },
    { id: "ra-current-address", label: "Current address", type: "text", required: true, explanation: "Your current full home address including city, state, and ZIP.", example: "789 Oak Street, Brooklyn, NY 11201", commonMistakes: "Omitting city or state.", profileKey: "address.street" },
    { id: "ra-current-landlord", label: "Current landlord name", type: "text", required: false, explanation: "The name of your current landlord or property management company.", example: "Brooklyn Heights Realty", commonMistakes: "Leaving blank if you have a landlord — landlords will call to verify." },
    { id: "ra-current-landlord-phone", label: "Current landlord phone", type: "text", required: false, explanation: "Phone number for your current landlord.", example: "718-555-0200", commonMistakes: "Providing an out-of-service number." },
    { id: "ra-monthly-rent", label: "Current monthly rent", type: "text", required: false, explanation: "How much you pay in rent each month at your current address.", example: "$2,200", commonMistakes: "Including utilities in the rent figure." },
    { id: "ra-employer", label: "Current employer name", type: "text", required: true, explanation: "The name of your current employer.", example: "Tech Solutions Inc.", commonMistakes: "Using a department name instead of the company name.", profileKey: "employerName" },
    { id: "ra-employer-phone", label: "Employer phone number", type: "text", required: false, explanation: "Your employer's main phone number so the landlord can verify employment.", example: "212-555-0300", commonMistakes: "Using your own work phone instead of the main company number." },
    { id: "ra-monthly-income", label: "Gross monthly income", type: "text", required: true, explanation: "Your total monthly income before taxes. Most landlords require 2.5–3x the monthly rent.", example: "$6,500", commonMistakes: "Using net (after-tax) income — use your gross (pre-tax) amount." },
    { id: "ra-ssn", label: "Social Security Number", type: "text", required: false, explanation: "Required to run a credit check. Only provide on official application forms.", example: "234-56-7890", commonMistakes: "Providing this on unofficial forms — verify you are submitting to a legitimate landlord.", profileKey: "ssn" },
    { id: "ra-ref1-name", label: "Reference #1 — Name", type: "text", required: false, explanation: "A non-family reference (former landlord, employer, or professional contact).", example: "Dr. Sarah Chen", commonMistakes: "Using a family member as a reference — landlords prefer non-relatives." },
    { id: "ra-ref1-phone", label: "Reference #1 — Phone", type: "text", required: false, explanation: "Phone number for your first reference.", example: "646-555-0400", commonMistakes: "Not notifying the reference that they may be called." },
  ],
};

export default form;
