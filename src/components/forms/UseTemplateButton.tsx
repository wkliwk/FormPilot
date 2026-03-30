"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  templateId: string;
}

export default function UseTemplateButton({ templateId }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleUse() {
    setLoading(true);
    try {
      const res = await fetch(`/api/templates/${templateId}/use`, { method: "POST" });
      if (res.status === 401) {
        // Not signed in — redirect to login with callback
        router.push(`/login?callbackUrl=/dashboard`);
        return;
      }
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        throw new Error(data.error ?? "Failed to use template");
      }
      const { formId } = await res.json() as { formId: string };
      router.push(`/dashboard/forms/${formId}`);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not use template");
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleUse}
      disabled={loading}
      className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-all shadow-sm active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
    >
      {loading ? (
        <>
          <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
            <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-75" />
          </svg>
          Opening form…
        </>
      ) : (
        <>
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
          Use this template
        </>
      )}
    </button>
  );
}
