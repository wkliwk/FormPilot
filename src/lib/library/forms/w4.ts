import type { LibraryFormDefinition } from "@/lib/library";

const form: LibraryFormDefinition = {
  slug: "w4",
  title: "W-4 Employee's Withholding Certificate",
  category: "Tax",
  description: "Tell your employer how much federal income tax to withhold from your paycheck.",
  estimatedMinutes: 8,
  fields: [
    { id: "w4-1a", label: "First name and middle initial", type: "text", required: true, explanation: "Your legal first name and middle initial as they appear on your Social Security card.", example: "John A", commonMistakes: "Using a nickname instead of your legal name.", profileKey: "firstName" },
    { id: "w4-1b", label: "Last name", type: "text", required: true, explanation: "Your legal last name as it appears on your Social Security card.", example: "Smith", commonMistakes: "Hyphenated names — use the full hyphenated form.", profileKey: "lastName" },
    { id: "w4-1c", label: "Home address", type: "text", required: true, explanation: "Your current home street address including apartment number if applicable.", example: "123 Main St Apt 4B", commonMistakes: "Using a P.O. Box — use your physical home address.", profileKey: "address.street" },
    { id: "w4-1d", label: "City, State, and ZIP code", type: "text", required: true, explanation: "Your city, two-letter state abbreviation, and 5-digit ZIP code.", example: "Los Angeles, CA 90001", commonMistakes: "Spelling out the state name — use the two-letter abbreviation.", profileKey: "address.city" },
    { id: "w4-2", label: "Social Security Number", type: "text", required: true, explanation: "Your 9-digit Social Security Number. Format: XXX-XX-XXXX.", example: "123-45-6789", commonMistakes: "Entering an ITIN (Individual Taxpayer Identification Number) — W-4 requires your SSN.", profileKey: "ssn" },
    { id: "w4-3", label: "Filing status", type: "select", required: true, explanation: "Your tax filing status. Most common: Single or Married filing jointly.", example: "Single", commonMistakes: "Choosing Head of Household if you don't qualify — you must have a qualifying dependent." },
    { id: "w4-4a", label: "Other income (not from jobs)", type: "number", required: false, explanation: "Dollar amount of other income you expect this year (interest, dividends, retirement income). Only fill if you want tax withheld on that income.", example: "2000", commonMistakes: "Including income from other jobs here — use Step 2 for that." },
    { id: "w4-4b", label: "Deductions (if itemizing)", type: "number", required: false, explanation: "Expected total deductions if you plan to itemize rather than take the standard deduction.", example: "15000", commonMistakes: "Entering the standard deduction here — only fill if your itemized deductions exceed the standard." },
    { id: "w4-4c", label: "Extra withholding per pay period", type: "number", required: false, explanation: "Additional dollar amount you want withheld from each paycheck beyond the calculated amount.", example: "50", commonMistakes: "Entering a yearly amount — this is per paycheck." },
    { id: "w4-5", label: "Employer's name and address", type: "text", required: true, explanation: "Your employer's full legal name and business address.", example: "Acme Corp, 500 Business Blvd, Chicago, IL 60601", commonMistakes: "Using a department name instead of the company's legal name.", profileKey: "employerName" },
    { id: "w4-6", label: "Employer EIN", type: "text", required: true, explanation: "Your employer's Employer Identification Number (EIN). Find it on your pay stub or ask HR.", example: "12-3456789", commonMistakes: "Confusing the EIN with the employee ID number." },
    { id: "w4-date", label: "Date signed", type: "date", required: true, explanation: "The date you are signing and submitting this form.", example: "2024-01-15", commonMistakes: "Using the date you were hired instead of the date you complete the form." },
  ],
};

export default form;
