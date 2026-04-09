"use client";

import { useState } from "react";
import OnboardingModal from "./OnboardingModal";

export default function OnboardingModalWrapper() {
  const [dismissed, setDismissed] = useState(false);

  function handleDismiss() {
    setDismissed(true);
    // Persist dismissal to DB (best-effort)
    fetch("/api/onboarding/dismiss", { method: "POST" }).catch(() => {});
  }

  if (dismissed) return null;

  return <OnboardingModal onDismiss={handleDismiss} />;
}
