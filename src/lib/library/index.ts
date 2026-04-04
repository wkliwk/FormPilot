import type { FormField } from "@/lib/ai/analyze-form";

export interface LibraryFormDefinition {
  slug: string;
  title: string;
  category: string;
  description: string;
  estimatedMinutes: number;
  fields: FormField[];
}

// Dynamic import of all library forms — avoids a giant bundle at route load time
const FORM_MODULES: Record<string, () => Promise<{ default: LibraryFormDefinition }>> = {
  "w4": () => import("./forms/w4"),
  "i9": () => import("./forms/i9"),
  "ds160-personal": () => import("./forms/ds160-personal"),
  "direct-deposit": () => import("./forms/direct-deposit"),
  "emergency-contact": () => import("./forms/emergency-contact"),
  "rental-application": () => import("./forms/rental-application"),
  "healthcare-intake": () => import("./forms/healthcare-intake"),
  "power-of-attorney": () => import("./forms/power-of-attorney"),
  "offer-letter-acceptance": () => import("./forms/offer-letter-acceptance"),
  "1040-schedule-a": () => import("./forms/1040-schedule-a"),
  "i765-ead": () => import("./forms/i765-ead"),
  "general-employment-app": () => import("./forms/general-employment-app"),
};

export const LIBRARY_SLUGS = Object.keys(FORM_MODULES);

export async function getLibraryForm(slug: string): Promise<LibraryFormDefinition | null> {
  const loader = FORM_MODULES[slug];
  if (!loader) return null;
  const mod = await loader();
  return mod.default;
}

/** Returns all library form definitions (lightweight — loads all modules) */
export async function getAllLibraryForms(): Promise<LibraryFormDefinition[]> {
  const entries = await Promise.all(
    Object.entries(FORM_MODULES).map(async ([, loader]) => {
      const mod = await loader();
      return mod.default;
    })
  );
  return entries;
}
