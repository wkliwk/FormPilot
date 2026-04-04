import type { LibraryFormDefinition } from "@/lib/library";

const form: LibraryFormDefinition = {
  slug: "i765-ead",
  title: "I-765 Employment Authorization Document",
  category: "Immigration",
  description: "Apply for or renew your Employment Authorization Document (EAD / work permit) with USCIS.",
  estimatedMinutes: 20,
  fields: [
    { id: "i765-family-name", label: "Family name (last name)", type: "text", required: true, explanation: "Your last name exactly as it appears in your passport or immigration documents.", example: "GUPTA", commonMistakes: "Not using all caps — USCIS forms typically use all capitals.", profileKey: "lastName" },
    { id: "i765-given-name", label: "Given name (first name)", type: "text", required: true, explanation: "Your first name exactly as it appears in your passport or immigration documents.", example: "ANANYA", commonMistakes: "Omitting middle name if it appears in your travel document.", profileKey: "firstName" },
    { id: "i765-middle-name", label: "Middle name (if applicable)", type: "text", required: false, explanation: "Your middle name as it appears in your passport. Write N/A if none.", example: "PRIYA", commonMistakes: "Leaving blank instead of writing N/A." },
    { id: "i765-other-names", label: "Other names used", type: "text", required: false, explanation: "Any other names you have used, including maiden name or aliases.", example: "ANANYA SHARMA", commonMistakes: "Leaving blank if you have used another name." },
    { id: "i765-dob", label: "Date of birth", type: "date", required: true, explanation: "Your date of birth exactly as in your passport.", example: "1995-03-12", commonMistakes: "Using a different format — use YYYY-MM-DD.", profileKey: "dateOfBirth" },
    { id: "i765-country-birth", label: "Country of birth", type: "text", required: true, explanation: "The country where you were born.", example: "India", commonMistakes: "Using abbreviations — spell out the full country name." },
    { id: "i765-country-citizenship", label: "Country of citizenship", type: "text", required: true, explanation: "The country of which you are currently a citizen.", example: "India", commonMistakes: "Confusing country of birth with country of citizenship for naturalised citizens." },
    { id: "i765-address", label: "Current mailing address", type: "text", required: true, explanation: "Your current US mailing address where USCIS will send your EAD card.", example: "500 University Ave, Apt 3B, Columbus, OH 43210", commonMistakes: "Using a temporary address — your EAD will be mailed here.", profileKey: "address.street" },
    { id: "i765-ssn", label: "US Social Security Number (if any)", type: "text", required: false, explanation: "Your SSN if you have previously been issued one. Leave blank if you have never had a US SSN.", example: "234-56-7890", commonMistakes: "Leaving blank if you do have an SSN — omitting it can delay processing.", profileKey: "ssn" },
    { id: "i765-alien-number", label: "USCIS/Alien Registration Number (A-Number)", type: "text", required: false, explanation: "Your 8- or 9-digit A-Number if you have one. Found on immigration documents, a previous EAD, or green card.", example: "A-123456789", commonMistakes: "Omitting the 'A' prefix." },
    { id: "i765-eligibility-category", label: "Eligibility category code", type: "text", required: true, explanation: "The category code that describes why you are eligible for work authorisation (e.g. (c)(3)(A) for F-1 OPT, (c)(9) for pending AOS). Check the I-765 instructions for your category.", example: "(c)(3)(A)", commonMistakes: "Using the wrong category code — this is the most common reason for rejection. Verify with your DSO or attorney." },
    { id: "i765-passport-num", label: "Passport number", type: "text", required: false, explanation: "Your current passport number.", example: "P1234567", commonMistakes: "Including spaces or dashes.", profileKey: "passportNumber" },
    { id: "i765-passport-expiry", label: "Passport expiration date", type: "date", required: false, explanation: "The expiration date of your current passport.", example: "2029-06-30", commonMistakes: "Applying with a passport that is about to expire — renew your passport first if needed." },
    { id: "i765-sign-date", label: "Date signed", type: "date", required: true, explanation: "The date you sign the application.", example: "2024-02-20", commonMistakes: "Pre-dating — must match the actual date you sign." },
  ],
};

export default form;
