export interface FAQItem {
  question: string;
  answer: string;
}

export const FAQ_ITEMS: FAQItem[] = [
  {
    question: "Is my personal data safe with FormPilot?",
    answer:
      "Yes. All sensitive data — including SSNs, passport numbers, and tax information — is encrypted at rest using AES-256-GCM. Your data is never sold or shared with third parties. You can delete your profile and all stored data at any time from the account settings page.",
  },
  {
    question: "How accurate is the AI autofill?",
    answer:
      "FormPilot shows a confidence score for every autofilled field so you always know how certain the suggestion is. You review every field before exporting — the AI gives you a strong starting point but you stay in control of the final document.",
  },
  {
    question: "What file formats are supported?",
    answer:
      "FormPilot supports PDF forms (.pdf), Word documents (.doc and .docx), and image uploads including PNG, JPEG, WebP, and HEIC. We parse every field automatically regardless of the file format.",
  },
  {
    question: "What types of forms work best?",
    answer:
      "FormPilot is optimised for tax forms (W-4, W-2, 1040, 1099), immigration forms (I-9, I-130, I-485, DS-160, N-400), government forms (SF-86, FAFSA), and HR onboarding paperwork. It works with any PDF or Word document, but structured official forms get the best results.",
  },
  {
    question: "Can I edit the AI suggestions before submitting?",
    answer:
      "Absolutely. Every field is fully editable. The AI suggestions are a starting point — you can accept, modify, or override any value. Nothing is submitted or exported without your explicit approval.",
  },
  {
    question: "What is included in the free plan?",
    answer:
      "The free plan includes 5 form uploads per month, full AI field explanations, autofill from your profile, and PDF export. All core features are available on the free plan — upgrade to Pro for unlimited uploads and priority support.",
  },
  {
    question: "Do you support languages other than English?",
    answer:
      "Yes. Field explanations are available in 12 languages. The AI provides plain-language help in your preferred language so you understand exactly what each field is asking, even when the form itself is in English.",
  },
  {
    question: "How do I export my completed form?",
    answer:
      "Once you have reviewed and filled all fields, click Export in the form editor. FormPilot exports as a PDF with the original form layout preserved, or as a Word document if you need further editing. The exported file is ready to print or submit digitally.",
  },
];
