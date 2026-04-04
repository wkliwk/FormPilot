import type { LibraryFormDefinition } from "@/lib/library";

const form: LibraryFormDefinition = {
  slug: "power-of-attorney",
  title: "General Power of Attorney",
  category: "Legal",
  description: "Designate another person (agent) to act on your behalf for financial and legal matters.",
  estimatedMinutes: 10,
  fields: [
    { id: "poa-principal-name", label: "Principal full legal name", type: "text", required: true, explanation: "Your full legal name — you are the principal granting authority.", example: "Robert James Mitchell", commonMistakes: "Using a middle initial instead of full middle name.", profileKey: "firstName" },
    { id: "poa-principal-address", label: "Principal address", type: "text", required: true, explanation: "Your current full home address.", example: "123 Elm Street, Portland, OR 97201", commonMistakes: "Using a PO Box — most states require a physical address.", profileKey: "address.street" },
    { id: "poa-principal-dob", label: "Principal date of birth", type: "date", required: false, explanation: "Your date of birth, used in some states to verify identity.", example: "1965-11-03", commonMistakes: "", profileKey: "dateOfBirth" },
    { id: "poa-agent-name", label: "Agent full legal name", type: "text", required: true, explanation: "The full legal name of the person you are appointing as your agent (attorney-in-fact).", example: "Linda Anne Mitchell", commonMistakes: "Using a nickname — must match the agent's legal ID exactly." },
    { id: "poa-agent-address", label: "Agent address", type: "text", required: true, explanation: "The agent's current full home address.", example: "456 Oak Avenue, Portland, OR 97202", commonMistakes: "Using an old address — the agent must be reachable." },
    { id: "poa-agent-relationship", label: "Agent relationship to principal", type: "text", required: false, explanation: "Your relationship to the agent.", example: "Spouse", commonMistakes: "" },
    { id: "poa-alt-agent-name", label: "Successor agent full name (if any)", type: "text", required: false, explanation: "An alternate agent to act if your primary agent is unable or unwilling.", example: "Thomas Patrick Mitchell", commonMistakes: "Leaving blank — without a successor, the POA may become unenforceable if your primary agent is unavailable." },
    { id: "poa-powers", label: "Powers granted", type: "text", required: true, explanation: "Describe the scope of authority — e.g. banking, real estate, tax matters. Many templates list specific powers to check off.", example: "Banking, real estate, tax filings", commonMistakes: "Being too vague — specify which powers to avoid disputes." },
    { id: "poa-effective-date", label: "Effective date", type: "date", required: true, explanation: "When the power of attorney becomes effective. Leave as today's date for immediate effect.", example: "2024-03-01", commonMistakes: "Confusing effective date with expiry date." },
    { id: "poa-expiry-date", label: "Expiration date (if applicable)", type: "date", required: false, explanation: "When the POA expires. Leave blank for a durable (indefinite) POA.", example: "2026-03-01", commonMistakes: "Leaving blank when you intend a limited duration — a blank expiry creates an indefinite POA." },
    { id: "poa-durable", label: "Is this a durable POA?", type: "select", required: true, explanation: "A durable POA remains valid if you become incapacitated. A non-durable POA terminates if you lose capacity.", example: "Yes — durable", commonMistakes: "Selecting non-durable when planning for illness or incapacity — most estate planning POAs are durable." },
    { id: "poa-sign-date", label: "Date signed", type: "date", required: true, explanation: "The date you sign this document. Must be signed in front of a notary in most states.", example: "2024-03-01", commonMistakes: "Pre-dating or post-dating — sign on the actual day of notarisation." },
  ],
};

export default form;
