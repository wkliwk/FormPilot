import type { LibraryFormDefinition } from "@/lib/library";

const form: LibraryFormDefinition = {
  slug: "emergency-contact",
  title: "Emergency Contact Form",
  category: "HR / Employment",
  description: "Provide contact information for someone to be notified in case of a workplace emergency.",
  estimatedMinutes: 5,
  fields: [
    { id: "ec-employee-name", label: "Employee full name", type: "text", required: true, explanation: "Your full legal name as your employer knows you.", example: "Carlos Rivera", commonMistakes: "Using a nickname.", profileKey: "firstName" },
    { id: "ec-employee-phone", label: "Employee phone number", type: "text", required: true, explanation: "Your direct phone number where you can be reached.", example: "512-555-0100", commonMistakes: "Providing a landline that you rarely answer.", profileKey: "phone" },
    { id: "ec-contact1-name", label: "Emergency contact #1 — Full name", type: "text", required: true, explanation: "Full name of the first person to contact in an emergency.", example: "Maria Rivera", commonMistakes: "Providing only a first name — include the last name." },
    { id: "ec-contact1-relationship", label: "Emergency contact #1 — Relationship", type: "text", required: true, explanation: "Your relationship to this contact.", example: "Spouse", commonMistakes: "Using abbreviations — spell it out." },
    { id: "ec-contact1-phone", label: "Emergency contact #1 — Phone (primary)", type: "text", required: true, explanation: "The contact's primary phone number including area code.", example: "512-555-0200", commonMistakes: "Forgetting the area code." },
    { id: "ec-contact1-phone-alt", label: "Emergency contact #1 — Phone (alternate)", type: "text", required: false, explanation: "An alternate phone number for the contact, such as a work number.", example: "512-555-0300", commonMistakes: "Repeating the same number as the primary." },
    { id: "ec-contact1-address", label: "Emergency contact #1 — Address", type: "text", required: false, explanation: "The contact's home or mailing address.", example: "123 Home St, Austin, TX 78701", commonMistakes: "Leaving blank — useful if the contact can't be reached by phone." },
    { id: "ec-contact2-name", label: "Emergency contact #2 — Full name", type: "text", required: false, explanation: "Full name of a secondary emergency contact.", example: "Roberto Rivera", commonMistakes: "Naming the same person as contact #1." },
    { id: "ec-contact2-relationship", label: "Emergency contact #2 — Relationship", type: "text", required: false, explanation: "Your relationship to the second contact.", example: "Parent", commonMistakes: "" },
    { id: "ec-contact2-phone", label: "Emergency contact #2 — Phone", type: "text", required: false, explanation: "The second contact's phone number.", example: "512-555-0400", commonMistakes: "Forgetting the area code." },
    { id: "ec-date", label: "Date completed", type: "date", required: true, explanation: "The date you are completing this form.", example: "2024-02-01", commonMistakes: "Using your hire date instead of today's date." },
  ],
};

export default form;
