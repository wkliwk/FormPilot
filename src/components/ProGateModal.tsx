"use client";

import { useState } from "react";
import UpgradeGateModal from "./UpgradeGateModal";

interface Props {
  feature: string;
  benefit?: string;
  isPro: boolean;
  children: React.ReactNode;
}

/**
 * Wraps a Pro-gated UI element. For Pro users, renders children unchanged.
 * For free users, intercepts clicks and shows the UpgradeGateModal instead.
 */
export default function ProGateModal({ feature, isPro, children }: Props) {
  const [open, setOpen] = useState(false);

  if (isPro) return <>{children}</>;

  return (
    <>
      {/* Click-trap wrapper — intercepts the click before the child navigates */}
      <div
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        className="cursor-pointer"
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen(true);
          }
        }}
        aria-label={`${feature} — Pro feature`}
      >
        {children}
      </div>

      {open && (
        <UpgradeGateModal
          reason="feature"
          featureName={feature}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
