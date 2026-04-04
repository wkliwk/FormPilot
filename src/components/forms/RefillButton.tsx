"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import UpgradeGateModal from "@/components/UpgradeGateModal";

interface Props {
  formId: string;
}

export default function RefillButton({ formId }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showUpgrade, setShowUpgrade] = useState(false);

  async function handleRefill() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/forms/${formId}/refill`, { method: "POST" });
      if (!res.ok) {
        if (res.status === 403) {
          setShowUpgrade(true);
          return;
        }
        const data = await res.json() as { error?: string };
        throw new Error(data.error ?? "Re-fill failed");
      }
      const data = await res.json() as { id: string };
      router.push(`/dashboard/forms/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start re-fill");
      setTimeout(() => setError(null), 4000);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative shrink-0">
      <button
        onClick={handleRefill}
        disabled={loading}
        className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg hover:bg-emerald-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        title="Start a new fill with your previous answers pre-loaded"
      >
        {loading ? (
          <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
            <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-75" />
          </svg>
        ) : (
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="1 4 1 10 7 10" />
            <path d="M3.51 15a9 9 0 1 0 .49-3.14" />
          </svg>
        )}
        Re-fill
      </button>
      {error && (
        <div className="absolute right-0 top-full mt-1 z-20 whitespace-nowrap text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-2 py-1">
          {error}
        </div>
      )}
      {showUpgrade && (
        <UpgradeGateModal
          reason="limit"
          trigger="refill"
          onClose={() => setShowUpgrade(false)}
        />
      )}
    </div>
  );
}
