"use client";

import { useState } from "react";
import { FAQ_ITEMS } from "@/lib/faq-items";
import type { FAQItem } from "@/lib/faq-items";

export { FAQ_ITEMS };

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={`w-5 h-5 text-slate-400 transition-transform duration-200 shrink-0 ${open ? "rotate-180" : ""}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function FAQAccordionItem({
  item,
  index,
}: {
  item: FAQItem;
  index: number;
}) {
  const [open, setOpen] = useState(false);
  const id = `faq-answer-${index}`;

  return (
    <div className="border border-slate-100 rounded-xl overflow-hidden bg-white shadow-soft">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((prev) => !prev)}
        className="w-full flex items-center justify-between gap-4 px-6 py-5 text-left hover:bg-slate-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-inset"
      >
        <span className="text-sm font-semibold text-slate-900">
          {item.question}
        </span>
        <ChevronIcon open={open} />
      </button>

      {open && (
        <div
          id={id}
          role="region"
          aria-label={item.question}
          className="px-6 pb-5"
        >
          <p className="text-sm text-slate-500 leading-relaxed">{item.answer}</p>
        </div>
      )}
    </div>
  );
}

export default function FAQSection() {
  return (
    <section
      aria-labelledby="faq-heading"
      className="max-w-3xl mx-auto px-4 sm:px-6 py-20 sm:py-28"
    >
      <div className="text-center mb-12">
        <h2
          id="faq-heading"
          className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight"
        >
          Frequently asked questions
        </h2>
        <p className="mt-4 text-lg text-slate-500">
          Everything you need to know before you start.
        </p>
      </div>

      <div className="space-y-3">
        {FAQ_ITEMS.map((item, i) => (
          <FAQAccordionItem key={i} item={item} index={i} />
        ))}
      </div>
    </section>
  );
}
