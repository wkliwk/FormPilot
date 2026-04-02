"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

/**
 * Invisible component placed on the landing page.
 * When ?ref=CODE is present, calls /api/referral/set to store the code in a cookie.
 * The cookie persists through the OAuth flow and is read on first dashboard load.
 */
export default function ReferralTracker() {
  const params = useSearchParams();

  useEffect(() => {
    const ref = params.get("ref");
    if (ref && /^[a-z0-9]{8}$/i.test(ref)) {
      fetch("/api/referral/set", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ref }),
      }).catch(() => {});
    }
  }, [params]);

  return null;
}
