"use client";

import { useState, useRef } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import type { FormField } from "@/lib/ai/analyze-form";

// PDF.js worker via CDN — no native binaries needed, works on Vercel
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface Props {
  formId: string;
  sourceType: string;
  fields: FormField[];
  activeFieldId: string | null;
  liveValues?: Record<string, string>;
}

export default function DocumentImageViewer({ formId, sourceType, fields, activeFieldId, liveValues = {} }: Props) {
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [pageWidth, setPageWidth] = useState<number | null>(null);
  const [pageHeight, setPageHeight] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const fileUrl = `/api/forms/${formId}/file`;

  // Jump to the active field's page automatically
  const activeField = activeFieldId ? fields.find((f) => f.id === activeFieldId) : null;
  const coords = activeField?.coordinates;

  if (coords?.page && coords.page !== currentPage) {
    setCurrentPage(coords.page);
  }

  // IMAGE sourceType: just render the raw image
  if (sourceType === "IMAGE") {
    return (
      <div className="flex-1 overflow-auto p-4 bg-slate-100">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={fileUrl} alt="Original document" className="w-full h-auto rounded shadow" />
      </div>
    );
  }

  // PDF / WORD: render with react-pdf client-side
  return (
    <div className="flex flex-col h-full">
      {/* Page navigation */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border-b border-slate-200 shrink-0">
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

      {/* PDF canvas + highlight overlay */}
      <div ref={containerRef} className="flex-1 overflow-auto bg-slate-100 flex justify-center p-4">
        <Document
          file={fileUrl}
          onLoadSuccess={({ numPages }) => setTotalPages(numPages)}
          loading={
            <div className="flex items-center justify-center h-64 w-full">
              <svg className="w-6 h-6 text-slate-400 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
                <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-75" />
              </svg>
            </div>
          }
          error={
            <div className="flex flex-col items-center justify-center gap-2 h-64 text-slate-400 text-sm">
              <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              <p>Could not load document</p>
            </div>
          }
        >
          <div className="relative inline-block shadow-lg">
            <Page
              pageNumber={currentPage}
              width={containerRef.current ? Math.min(containerRef.current.clientWidth - 32, 900) : 700}
              renderAnnotationLayer={false}
              renderTextLayer={false}
              onRenderSuccess={(page) => {
                setPageWidth(page.width);
                setPageHeight(page.height);
              }}
            />

            {/* Text overlays: show live values for all fields with coordinates on this page */}
            {fields.map((field) => {
              const c = field.coordinates;
              if (!c || c.page !== currentPage) return null;
              const value = liveValues[field.id];
              const isActive = field.id === activeFieldId;
              return (
                <div
                  key={field.id}
                  aria-hidden="true"
                  className="absolute pointer-events-none overflow-hidden"
                  style={{
                    left: `${c.x * 100}%`,
                    top: `${c.y * 100}%`,
                    width: `${c.w * 100}%`,
                    height: `${c.h * 100}%`,
                    border: isActive ? "2px solid rgba(217, 119, 6, 0.85)" : "none",
                    backgroundColor: isActive ? "rgba(251, 191, 36, 0.15)" : "transparent",
                    borderRadius: "2px",
                    boxShadow: isActive ? "0 0 0 3px rgba(251, 191, 36, 0.2)" : "none",
                    display: "flex",
                    alignItems: "center",
                    paddingLeft: "3px",
                    paddingRight: "3px",
                  }}
                >
                  {value && (
                    <span
                      style={{
                        fontSize: "clamp(7px, 1.2%, 13px)",
                        color: "#1e40af",
                        fontFamily: "Arial, sans-serif",
                        lineHeight: 1.2,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        width: "100%",
                      }}
                    >
                      {value}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </Document>
      </div>

      {/* Footer hint when field has no coordinates */}
      {activeField && !coords && (
        <div className="px-3 py-2 bg-amber-50 border-t border-amber-200 text-xs text-amber-700 flex items-center gap-1.5 shrink-0">
          <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <span><strong>{activeField.label}</strong> — location not mapped for this field</span>
        </div>
      )}

      {activeField && coords && coords.page !== currentPage && (
        <div className="px-3 py-2 bg-blue-50 border-t border-blue-200 text-xs text-blue-700 flex items-center gap-1.5 shrink-0">
          <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <span><strong>{activeField.label}</strong> is on page {coords.page}</span>
          <button onClick={() => setCurrentPage(coords.page)} className="ml-auto underline hover:no-underline">
            Jump there
          </button>
        </div>
      )}
    </div>
  );
}
