import type { LibraryFormDefinition } from "@/lib/library";

const form: LibraryFormDefinition = {
  slug: "ds160-personal",
  title: "DS-160 Personal Information (Nonimmigrant Visa)",
  category: "Immigration",
  description: "Personal information section of the US nonimmigrant visa application (B1/B2, F-1, etc.).",
  estimatedMinutes: 15,
  fields: [
    { id: "ds-surname", label: "Surnames", type: "text", required: true, explanation: "Your last name(s) exactly as shown in your passport.", example: "CHEN", commonMistakes: "Not capitalizing — the DS-160 uses all caps.", profileKey: "lastName" },
    { id: "ds-given", label: "Given names", type: "text", required: true, explanation: "Your first and middle name(s) exactly as in your passport.", example: "WEI MING", commonMistakes: "Omitting the middle name if it appears in your passport.", profileKey: "firstName" },
    { id: "ds-telecode", label: "Telecode surname (if applicable)", type: "text", required: false, explanation: "The four-digit telecode for your surname in Chinese, Japanese, Korean, or Arabic script. Leave blank if not applicable.", example: "2421", commonMistakes: "Leaving blank when your name has a standard telecode." },
    { id: "ds-sex", label: "Sex", type: "select", required: true, explanation: "Your sex as shown on your passport.", example: "Male", commonMistakes: "Selecting a different gender than what appears on your travel document." },
    { id: "ds-marital", label: "Marital status", type: "select", required: true, explanation: "Your current marital status.", example: "Single", commonMistakes: "Selecting 'Divorced' when legally separated but not yet divorced." },
    { id: "ds-dob", label: "Date of birth", type: "date", required: true, explanation: "Your date of birth in DD/MMM/YYYY format, as it appears on your passport.", example: "12/JAN/1995", commonMistakes: "Using numbers for the month instead of the three-letter abbreviation.", profileKey: "dateOfBirth" },
    { id: "ds-birth-city", label: "City of birth", type: "text", required: true, explanation: "The city where you were born, as it appears on your birth certificate or passport.", example: "Beijing", commonMistakes: "Using the current name of a city that has changed names." },
    { id: "ds-birth-country", label: "Country/Region of birth", type: "text", required: true, explanation: "The country where you were born. Use the current country name.", example: "China", commonMistakes: "Using the country name at the time of birth if it has since changed." },
    { id: "ds-nationality", label: "Country/Region of origin (nationality)", type: "text", required: true, explanation: "The country of your primary citizenship or nationality.", example: "China", commonMistakes: "Confusing citizenship with country of birth if you have dual citizenship." },
    { id: "ds-other-nationality", label: "Do you hold other nationalities?", type: "select", required: true, explanation: "Indicate whether you hold citizenship in any other country besides your primary nationality.", example: "No", commonMistakes: "Answering No if you have dual citizenship — always disclose all nationalities." },
    { id: "ds-passport-num", label: "Passport number", type: "text", required: true, explanation: "Your passport number as shown on the data page of your passport.", example: "E12345678", commonMistakes: "Including spaces — enter the number exactly as shown, no spaces.", profileKey: "passportNumber" },
    { id: "ds-passport-type", label: "Passport book type", type: "select", required: true, explanation: "The type of passport you hold.", example: "Regular/Ordinary", commonMistakes: "Selecting 'Diplomatic' for a government employee who holds a regular passport." },
    { id: "ds-passport-country", label: "Passport issuing country/authority", type: "text", required: true, explanation: "The country or authority that issued your passport.", example: "China", commonMistakes: "Entering a city or province instead of the country." },
    { id: "ds-passport-issue", label: "Passport issuance date", type: "date", required: true, explanation: "The date your passport was issued, as shown on the data page.", example: "01/JAN/2020", commonMistakes: "Confusing the issue date with the expiry date." },
    { id: "ds-passport-expiry", label: "Passport expiration date", type: "date", required: true, explanation: "The date your passport expires. Your passport must typically be valid for at least 6 months beyond your intended stay.", example: "01/JAN/2030", commonMistakes: "Applying with a passport that expires within 6 months of your intended return date." },
  ],
};

export default form;
