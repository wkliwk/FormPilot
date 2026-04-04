import type { LibraryFormDefinition } from "@/lib/library";

const form: LibraryFormDefinition = {
  slug: "direct-deposit",
  title: "Direct Deposit Authorization",
  category: "HR / Employment",
  description: "Authorize your employer or payer to deposit funds directly into your bank account.",
  estimatedMinutes: 5,
  fields: [
    { id: "dd-name", label: "Account holder full name", type: "text", required: true, explanation: "Your full legal name as it appears on your bank account.", example: "Jane Marie Doe", commonMistakes: "Using a nickname — must match your bank account name exactly.", profileKey: "firstName" },
    { id: "dd-employer", label: "Employer / Company name", type: "text", required: true, explanation: "Your employer's or payer's legal name.", example: "Acme Corporation", commonMistakes: "Using a department name instead of the company name.", profileKey: "employerName" },
    { id: "dd-bank", label: "Bank or financial institution name", type: "text", required: true, explanation: "The full legal name of your bank or credit union.", example: "Chase Bank", commonMistakes: "Using the app name (e.g., 'Chime') instead of the underlying bank name." },
    { id: "dd-routing", label: "Bank routing number (ABA)", type: "text", required: true, explanation: "Your bank's 9-digit routing number. Find it on the bottom-left of a check, or in your bank's app under account details.", example: "021000021", commonMistakes: "Confusing it with your account number — routing is always 9 digits." },
    { id: "dd-account", label: "Account number", type: "text", required: true, explanation: "Your bank account number. Find it on the bottom of a check (to the right of the routing number), or in your bank's app.", example: "1234567890", commonMistakes: "Using the card number on your debit card — that is not your account number." },
    { id: "dd-account-type", label: "Account type", type: "select", required: true, explanation: "Whether you want deposits sent to a checking or savings account.", example: "Checking", commonMistakes: "Selecting 'Savings' for a money market account — verify with your bank." },
    { id: "dd-amount-type", label: "Deposit type", type: "select", required: true, explanation: "Whether to deposit all, a fixed amount, or a percentage of your net pay.", example: "Entire net pay", commonMistakes: "Selecting 'Percentage' when your employer only supports flat amounts." },
    { id: "dd-amount", label: "Amount or percentage (if partial)", type: "text", required: false, explanation: "If you chose a fixed amount or percentage, enter it here. Leave blank for full net pay.", example: "500 or 25%", commonMistakes: "Entering a dollar sign — most forms don't want the $ symbol." },
    { id: "dd-date", label: "Effective date", type: "date", required: false, explanation: "The date you want the direct deposit to take effect. Leave blank to make it effective immediately.", example: "2024-03-01", commonMistakes: "Choosing a date mid-pay-cycle — changes usually take effect the next full pay cycle." },
    { id: "dd-address", label: "Your home address", type: "text", required: false, explanation: "Your current home address for the employer's records.", example: "789 Elm Street, Seattle, WA 98101", commonMistakes: "Using a work address instead of your home address.", profileKey: "address.street" },
  ],
};

export default form;
