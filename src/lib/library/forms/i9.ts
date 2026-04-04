import type { LibraryFormDefinition } from "@/lib/library";

const form: LibraryFormDefinition = {
  slug: "i9",
  title: "I-9 Employment Eligibility Verification",
  category: "HR / Employment",
  description: "Federal form that verifies your identity and authorization to work in the United States.",
  estimatedMinutes: 10,
  fields: [
    { id: "i9-last", label: "Last name (Family name)", type: "text", required: true, explanation: "Your legal last name as shown on identity documents.", example: "Johnson", commonMistakes: "Using a name different from your identity documents.", profileKey: "lastName" },
    { id: "i9-first", label: "First name (Given name)", type: "text", required: true, explanation: "Your legal first name as shown on identity documents.", example: "Maria", commonMistakes: "Using a nickname.", profileKey: "firstName" },
    { id: "i9-middle", label: "Middle initial", type: "text", required: false, explanation: "Your middle initial. Write N/A if you have no middle name.", example: "L", commonMistakes: "Leaving blank instead of writing N/A if you have no middle name." },
    { id: "i9-other-names", label: "Other last names used", type: "text", required: false, explanation: "Any other last names you have used, such as a maiden name or previous married name. Write N/A if none.", example: "Garcia", commonMistakes: "Leaving blank instead of writing N/A." },
    { id: "i9-address", label: "Address (Street number and name)", type: "text", required: true, explanation: "Your current home street address.", example: "456 Oak Avenue", commonMistakes: "Using a P.O. Box — must be a physical address.", profileKey: "address.street" },
    { id: "i9-apt", label: "Apt. Number", type: "text", required: false, explanation: "Your apartment or unit number. Write N/A if you live in a house.", example: "Apt 2C", commonMistakes: "Leaving blank instead of writing N/A for a house." },
    { id: "i9-city", label: "City or Town", type: "text", required: true, explanation: "The city or town of your home address.", example: "Miami", commonMistakes: "Including the state in this field.", profileKey: "address.city" },
    { id: "i9-state", label: "State", type: "text", required: true, explanation: "Two-letter US state abbreviation.", example: "FL", commonMistakes: "Spelling out the full state name.", profileKey: "address.state" },
    { id: "i9-zip", label: "ZIP Code", type: "text", required: true, explanation: "Your 5-digit ZIP code.", example: "33101", commonMistakes: "Using a 9-digit ZIP+4 format.", profileKey: "address.zip" },
    { id: "i9-dob", label: "Date of Birth", type: "date", required: true, explanation: "Your date of birth in MM/DD/YYYY format.", example: "05/15/1990", commonMistakes: "Using DD/MM/YYYY format instead of MM/DD/YYYY.", profileKey: "dateOfBirth" },
    { id: "i9-ssn", label: "U.S. Social Security Number", type: "text", required: false, explanation: "Your 9-digit SSN. Required only if your employer participates in E-Verify.", example: "234-56-7890", commonMistakes: "Refusing to provide it if your employer uses E-Verify — it becomes required then.", profileKey: "ssn" },
    { id: "i9-email", label: "Employee's Email Address", type: "email", required: false, explanation: "Your personal or work email address. Write N/A if you prefer not to provide one.", example: "maria@email.com", commonMistakes: "Using a temporary email.", profileKey: "email" },
    { id: "i9-phone", label: "Employee's Telephone Number", type: "text", required: false, explanation: "Your phone number where you can be reached. Write N/A if you prefer not to provide one.", example: "305-555-0123", commonMistakes: "Forgetting to include the area code.", profileKey: "phone" },
    { id: "i9-citizenship", label: "Citizenship/Immigration status", type: "select", required: true, explanation: "Select the option that describes your work authorization status in the US.", example: "A citizen of the United States", commonMistakes: "Selecting 'Lawful Permanent Resident' if your green card has expired — the status itself is still valid." },
  ],
};

export default form;
