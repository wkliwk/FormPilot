import type { LibraryFormDefinition } from "@/lib/library";

const form: LibraryFormDefinition = {
  slug: "healthcare-intake",
  title: "Healthcare Patient Intake",
  category: "Healthcare",
  description: "New patient intake form for a medical practice — demographics, insurance, medical history, and emergency contact.",
  estimatedMinutes: 10,
  fields: [
    { id: "hi-name", label: "Patient full name", type: "text", required: true, explanation: "Your full legal name as it appears on your insurance card and ID.", example: "Elena Vasquez", commonMistakes: "Using a preferred name instead of your legal name.", profileKey: "firstName" },
    { id: "hi-dob", label: "Date of birth", type: "date", required: true, explanation: "Used to verify your identity and match insurance records.", example: "1990-04-22", commonMistakes: "Entering the wrong year.", profileKey: "dateOfBirth" },
    { id: "hi-sex", label: "Sex (for medical records)", type: "select", required: true, explanation: "Your biological sex as recorded on insurance and medical records.", example: "Female", commonMistakes: "Confusing sex with gender — this field is typically for billing/clinical purposes." },
    { id: "hi-phone", label: "Phone number", type: "text", required: true, explanation: "The best phone number to reach you for appointment reminders.", example: "512-555-0101", commonMistakes: "Providing a number you rarely answer.", profileKey: "phone" },
    { id: "hi-email", label: "Email address", type: "email", required: false, explanation: "For appointment confirmations and patient portal access.", example: "elena.vasquez@email.com", commonMistakes: "Using a shared family email.", profileKey: "email" },
    { id: "hi-address", label: "Home address", type: "text", required: true, explanation: "Your current home address including city, state, and ZIP.", example: "456 Maple Drive, Austin, TX 78703", commonMistakes: "Using a work address instead of your home address.", profileKey: "address.street" },
    { id: "hi-insurance-name", label: "Insurance plan / company name", type: "text", required: false, explanation: "The name of your health insurance provider.", example: "Blue Cross Blue Shield", commonMistakes: "Writing your employer's name instead of the insurance company." },
    { id: "hi-insurance-id", label: "Insurance member ID", type: "text", required: false, explanation: "Your member ID as shown on your insurance card.", example: "XYZ123456789", commonMistakes: "Confusing the group number with the member ID — they are separate numbers." },
    { id: "hi-insurance-group", label: "Insurance group number", type: "text", required: false, explanation: "Your plan's group number, also on your insurance card.", example: "G-78901", commonMistakes: "Leaving blank — missing group number can cause claim denials." },
    { id: "hi-pcp", label: "Primary care physician (if any)", type: "text", required: false, explanation: "The name of your current primary care doctor, if you have one.", example: "Dr. James Park", commonMistakes: "Leaving blank if you have a PCP — referrals may require this information." },
    { id: "hi-allergies", label: "Known allergies", type: "text", required: false, explanation: "List any known drug, food, or environmental allergies. Write 'NKDA' (no known drug allergies) if none.", example: "Penicillin, shellfish", commonMistakes: "Leaving blank instead of writing NKDA — blank may be assumed unknown." },
    { id: "hi-medications", label: "Current medications", type: "text", required: false, explanation: "List all current prescription and over-the-counter medications and supplements.", example: "Lisinopril 10mg, Vitamin D 2000 IU", commonMistakes: "Forgetting supplements and vitamins — these can interact with prescriptions." },
    { id: "hi-emergency-name", label: "Emergency contact — Name", type: "text", required: true, explanation: "Full name of the person to contact in an emergency.", example: "Marco Vasquez", commonMistakes: "Not providing a contact — required at most practices." },
    { id: "hi-emergency-phone", label: "Emergency contact — Phone", type: "text", required: true, explanation: "Phone number for your emergency contact.", example: "512-555-0202", commonMistakes: "Using your own number." },
  ],
};

export default form;
