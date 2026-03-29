"use client";

import { useState, useEffect, useRef } from "react";
import type { FormField } from "@/lib/ai/analyze-form";

interface Props {
  formId: string;
  fields: FormField[];
  activeFieldId: string | null;
}

export default function DocumentImageViewer({ formId, fields, activeFieldId }: Props) {
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [imgDimensions, setImgDimensions] = useState<{ width: number; height: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const imgSrc = `/api/forms/${formId}/render-page?page=${currentPage}`;

  // When activeFieldId changes, jump to that field's page if it has coordinates
  useEffect(() => {
    if (!activeFieldId) return;
    const field = fields.find((f) => f.id === activeFieldId);
    if (field?.coordinates?.page && field.coordinates.page !== currentPage) {
      setCurrentPage(field.coordinates.page);
    }
  }, [activeFieldId, fields, currentPage]);

  function handleImgLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    setLoading(false);
    setError(null);
    const img = e.currentTarget;
    setImgDimensions({ width: img.naturalWidth, height: img.naturalHeight });
    // Read total pages from response headers via a HEAD request (fallback: stay at 1)
    fetch(`/api/forms/${formId}/render-page?page=${currentPage}`, { method: "HEAD" })
      .then((res) => {
        const count = res.headers.get("X-Page-Count");
        if (count) setTotalPages(parseInt(count, 10));
      })
      .catch(() => {
        // ignore — totalPages stays at 1
      });
  }

  function handleImgError() {
    setLoading(false);
    setError("Could not render page");
  }

  // Active field highlight box
  const activeField = activeFieldId ? fields.find((f) => f.id === activeFieldId) : null;
  const coords = activeField?.coordinates;
  const showHighlight =
    coords != null &&
    coords.page === currentPage &&
    imgDimensions != null;

  return (
    <div className="flex flex-col h-full">
      {/* Page navigation */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border-b border-slate-200">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage <= 1}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            aria-label="Previous page"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <span className="text-xs text-slate-500 tabular-nums">
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage >= totalPages}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            aria-label="Next page"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>
      )}

      {/* Image + highlight overlay */}
      <div ref={containerRef} className="relative flex-1 overflow-auto bg-slate-100">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <svg className="w-6 h-6 text-slate-400 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
              <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-75" />
            </svg>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-400 text-sm px-4 text-center">
            <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
            <p>Preview not available</p>
          </div>
        )}

        <div className="relative inline-block w-full">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={imgRef}
            key={`${formId}-page-${currentPage}`}
            src={imgSrc}
            alt={`Document page ${currentPage}`}
            className="w-full h-auto block"
            onLoad={handleImgLoad}
            onError={handleImgError}
          />

          {/* Highlight overlay */}
          {showHighlight && coords && (
            <div
              aria-hidden="true"
              className="absolute pointer-events-none animate-pulse"
              style={{
                left: `${coords.x * 100}%`,
                top: `${coords.y * 100}%`,
                width: `${coords.w * 100}%`,
                height: `${coords.h * 100}%`,
                backgroundColor: "rgba(251, 191, 36, 0.35)",
                border: "2px solid rgba(217, 119, 6, 0.8)",
                borderRadius: "2px",
                boxShadow: "0 0 0 2px rgba(251, 191, 36, 0.3)",
              }}
            />
          )}
        </div>
      </div>

      {/* Field locator panel: show which page has the active field, even without coords */}
      {activeField && !coords && (
        <div className="px-3 py-2 bg-amber-50 border-t border-amber-200 text-xs text-amber-700 flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <span>
            <strong>{activeField.label}</strong> — location not available for this field
          </span>
        </div>
      )}

      {activeField && coords && coords.page !== currentPage && (
        <div className="px-3 py-2 bg-blue-50 border-t border-blue-200 text-xs text-blue-700 flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <span>
            <strong>{activeField.label}</strong> is on page {coords.page}
          </span>
          <button
            onClick={() => setCurrentPage(coords.page)}
            className="ml-auto underline hover:no-underline"
          >
            Jump there
          </button>
        </div>
      )}
    </div>
  );
}
