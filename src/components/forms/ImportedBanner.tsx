"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";

export default function ImportedBanner() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (params.get("imported") === "1") {
      setShow(true);
      // Remove the query param without a full navigation
      router.replace(pathname, { scroll: false });
      const t = setTimeout(() => setShow(false), 5000);
      return () => clearTimeout(t);
    }
  }, [params, router, pathname]);

  if (!show) return null;

  return (
    <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3.5 animate-slide-down">
      <svg className="w-5 h-5 text-emerald-500 shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
      </svg>
      <p className="text-sm text-emerald-700 font-medium">Profile imported successfully!</p>
    </div>
  );
}
