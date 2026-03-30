"use client";

import { useState, useRef, useCallback } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import type { FormField } from "@/lib/ai/analyze-form";
import { normalize, matchAnnotationToField } from "@/lib/pdf/annotation-helpers";

// PDF.js worker via CDN — no native binaries needed, works on Vercel
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface FieldCoord {
  x: number; y: number; w: number; h: number; page: number;
}

interface Props {
  formId: string;
  sourceType: string;
  fields: FormField[];
  activeFieldId: string | null;
  liveValues?: Record<string, string>;
  /** On mobile: render a collapsed thumbnail strip with tap-to-expand. Desktop always shows full. */
  mobileCollapsed?: boolean;
}

export default function DocumentImageViewer({
  formId,
  sourceType,
  fields,
  activeFieldId,
  liveValues = {},
  mobileCollapsed = false,
}: Props) {
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [renderedSize, setRenderedSize] = useState<{ w: number; h: number } | null>(null);
  const [mobileExpanded, setMobileExpanded] = useState(false);
  // fieldId -> normalized 0-1 coordinates derived from PDF annotations
  const [annotCoords, setAnnotCoords] = useState<Record<string, FieldCoord>>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const pdfDocRef = useRef<unknown>(null);

  const fileUrl = `/api/forms/${formId}/file`;

  // Merge annotation-derived coords with AI-extracted coords (AI coords take priority if present)
  function getCoords(field: FormField): FieldCoord | null {
    if (field.coordinates) return field.coordinates;
    return annotCoords[field.id] ?? null;
  }

  // Jump to active field's page
  const activeField = activeFieldId ? fields.find((f) => f.id === activeFieldId) : null;
  const activeCoords = activeField ? getCoords(activeField) : null;
  if (activeCoords?.page && activeCoords.page !== currentPage) {
    setCurrentPage(activeCoords.page);
  }

  /**
   * After a page renders, extract AcroForm annotations for that page and
   * convert their rect [x1,y1,x2,y2] to 0-1 fractions of page dimensions.
   */
  const extractAnnotations = useCallback(
    async (pageNum: number, pageWidthPt: number, pageHeightPt: number) => {
      if (!pdfDocRef.current) return;
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pdfDoc = pdfDocRef.current as any;
        const page = await pdfDoc.getPage(pageNum);
        const annotations = await page.getAnnotations();

        const newCoords: Record<string, FieldCoord> = {};
        for (const annot of annotations) {
          if (!annot.rect) continue;
          const fieldId = matchAnnotationToField(annot, fields);
          if (!fieldId) continue;

          const [x1, y1, x2, y2] = annot.rect as number[];
          // PDF coordinate system: y=0 is bottom. Convert to top-left origin.
          const x = x1 / pageWidthPt;
          const y = 1 - y2 / pageHeightPt; // flip y
          const w = (x2 - x1) / pageWidthPt;
          const h = (y2 - y1) / pageHeightPt;

          newCoords[fieldId] = { x, y, w, h, page: pageNum };
        }

        if (Object.keys(newCoords).length > 0) {
          setAnnotCoords((prev) => ({ ...prev, ...newCoords }));
        }
      } catch {
        // Annotation extraction is best-effort
      }
    },
    [fields]
  );

  // IMAGE sourceType: just render the raw image
  if (sourceType === "IMAGE") {
    if (mobileCollapsed) {
      return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-soft overflow-hidden">
          <button
            type="button"
            onClick={() => setMobileExpanded((v) => !v)}
            className="w-full flex items-center justify-between gap-2 px-4 py-3 bg-slate-50 border-b border-slate-200 min-h-[48px]"
            aria-expanded={mobileExpanded}
            aria-controls="mobile-doc-viewer"
          >
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-slate-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              <span className="text-xs font-medium text-slate-600">Original Document</span>
            </div>
            <svg
              className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${mobileExpanded ? "rotate-180" : ""}`}
              viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          {mobileExpanded && (
            <div id="mobile-doc-viewer" className="overflow-auto bg-slate-100 p-3" style={{ maxHeight: "60vh" }}>
              <div className="relative inline-block w-full">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={fileUrl}
                  alt="Original document"
                  className="w-full h-auto rounded shadow block"
                  onLoad={(e) => {
                    const img = e.currentTarget;
                    setRenderedSize({ w: img.clientWidth, h: img.clientHeight });
                  }}
                />
                {renderedSize && fields.map((field) => {
                  const c = getCoords(field);
                  if (!c || c.page !== 1) return null;
                  const isActive = field.id === activeFieldId;
                  const value = liveValues[field.id];
                  return <FieldOverlay key={field.id} c={c} isActive={isActive} value={value} />;
                })}
              </div>
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="flex-1 overflow-auto p-4 bg-slate-100 relative">
        <div className="relative inline-block w-full">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={fileUrl}
            alt="Original document"
            className="w-full h-auto rounded shadow block"
            onLoad={(e) => {
              const img = e.currentTarget;
              setRenderedSize({ w: img.clientWidth, h: img.clientHeight });
            }}
          />
          {/* Overlays for image */}
          {renderedSize && fields.map((field) => {
            const c = getCoords(field);
            if (!c || c.page !== 1) return null;
            const isActive = field.id === activeFieldId;
            const value = liveValues[field.id];
            return (
              <FieldOverlay key={field.id} c={c} isActive={isActive} value={value} />
            );
          })}
        </div>
      </div>
    );
  }

  // PDF / WORD: render with react-pdf client-side
  const pageWidth = containerRef.current
    ? Math.min(containerRef.current.clientWidth - 32, 900)
    : 700;

  if (mobileCollapsed) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-soft overflow-hidden">
        <button
          type="button"
          onClick={() => setMobileExpanded((v) => !v)}
          className="w-full flex items-center justify-between gap-2 px-4 py-3 bg-slate-50 border-b border-slate-200 min-h-[48px]"
          aria-expanded={mobileExpanded}
          aria-controls="mobile-doc-viewer-pdf"
        >
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-slate-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
            <span className="text-xs font-medium text-slate-600">Original Document</span>
            {totalPages > 1 && (
              <span className="text-xs text-slate-400">({totalPages} pages)</span>
            )}
          </div>
          <svg
            className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${mobileExpanded ? "rotate-180" : ""}`}
            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
        {mobileExpanded && (
          <div id="mobile-doc-viewer-pdf" className="flex flex-col" style={{ maxHeight: "60vh" }}>
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
                <span className="text-xs text-slate-500 tabular-nums">Page {currentPage} of {totalPages}</span>
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
            <div ref={containerRef} className="flex-1 overflow-auto bg-slate-100 flex justify-center p-3">
              <Document
                file={fileUrl}
                onLoadSuccess={(doc) => {
                  setTotalPages(doc.numPages);
                  pdfDocRef.current = doc;
                }}
                loading={<Spinner />}
                error={<DocError />}
              >
                <div className="relative inline-block shadow-lg">
                  <Page
                    pageNumber={currentPage}
                    width={pageWidth}
                    renderAnnotationLayer={false}
                    renderTextLayer={false}
                    onRenderSuccess={(page) => {
                      setRenderedSize({ w: page.width, h: page.height });
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      const orig = page as any;
                      const ptW = orig.originalWidth ?? orig.width;
                      const ptH = orig.originalHeight ?? orig.height;
                      extractAnnotations(currentPage, ptW, ptH);
                    }}
                  />
                  {renderedSize && fields.map((field) => {
                    const c = getCoords(field);
                    if (!c || c.page !== currentPage) return null;
                    const isActive = field.id === activeFieldId;
                    const value = liveValues[field.id];
                    return <FieldOverlay key={field.id} c={c} isActive={isActive} value={value} />;
                  })}
                </div>
              </Document>
            </div>
          </div>
        )}
      </div>
    );
  }

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
          <span className="text-xs text-slate-500 tabular-nums">Page {currentPage} of {totalPages}</span>
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

      {/* PDF canvas + overlays */}
      <div ref={containerRef} className="flex-1 overflow-auto bg-slate-100 flex justify-center p-4">
        <Document
          file={fileUrl}
          onLoadSuccess={(doc) => {
            setTotalPages(doc.numPages);
            // Store raw pdfjs doc reference for annotation extraction
            pdfDocRef.current = doc;
          }}
          loading={<Spinner />}
          error={<DocError />}
        >
          <div className="relative inline-block shadow-lg">
            <Page
              pageNumber={currentPage}
              width={pageWidth}
              renderAnnotationLayer={false}
              renderTextLayer={false}
              onRenderSuccess={(page) => {
                setRenderedSize({ w: page.width, h: page.height });
                // Extract annotations using PDF point dimensions (not rendered px)
                // page.originalWidth/originalHeight are in PDF units (points)
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const orig = page as any;
                const ptW = orig.originalWidth ?? orig.width;
                const ptH = orig.originalHeight ?? orig.height;
                extractAnnotations(currentPage, ptW, ptH);
              }}
            />

            {/* Field overlays */}
            {renderedSize && fields.map((field) => {
              const c = getCoords(field);
              if (!c || c.page !== currentPage) return null;
              const isActive = field.id === activeFieldId;
              const value = liveValues[field.id];
              return (
                <FieldOverlay key={field.id} c={c} isActive={isActive} value={value} />
              );
            })}
          </div>
        </Document>
      </div>

      {/* Footer hint */}
      {activeField && !activeCoords && (
        <div className="px-3 py-2 bg-amber-50 border-t border-amber-200 text-xs text-amber-700 flex items-center gap-1.5 shrink-0">
          <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <span><strong>{activeField.label}</strong> — location not found in document</span>
        </div>
      )}

      {activeField && activeCoords && activeCoords.page !== currentPage && (
        <div className="px-3 py-2 bg-blue-50 border-t border-blue-200 text-xs text-blue-700 flex items-center gap-1.5 shrink-0">
          <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <span><strong>{activeField.label}</strong> is on page {activeCoords.page}</span>
          <button onClick={() => setCurrentPage(activeCoords.page)} className="ml-auto underline hover:no-underline">
            Jump there
          </button>
        </div>
      )}
    </div>
  );
}

/** Absolutely-positioned overlay for a single field */
function FieldOverlay({
  c,
  isActive,
  value,
}: {
  c: FieldCoord;
  isActive: boolean;
  value: string | undefined;
}) {
  return (
    <div
      aria-hidden="true"
      className="absolute pointer-events-none overflow-hidden flex items-center"
      style={{
        left: `${c.x * 100}%`,
        top: `${c.y * 100}%`,
        width: `${c.w * 100}%`,
        height: `${c.h * 100}%`,
        border: isActive ? "2px solid rgba(217, 119, 6, 0.9)" : "none",
        backgroundColor: isActive ? "rgba(251, 191, 36, 0.18)" : "transparent",
        borderRadius: "2px",
        boxShadow: isActive ? "0 0 0 3px rgba(251, 191, 36, 0.2)" : "none",
        paddingLeft: "3px",
        paddingRight: "3px",
        transition: "background-color 0.15s, border-color 0.15s",
      }}
    >
      {value && (
        <span
          style={{
            fontSize: "clamp(7px, 1.5cqw, 13px)",
            color: "#1d4ed8",
            fontFamily: "Arial, sans-serif",
            lineHeight: 1,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            width: "100%",
            display: "block",
          }}
        >
          {value}
        </span>
      )}
    </div>
  );
}

function Spinner() {
  return (
    <div className="flex items-center justify-center h-64 w-64">
      <svg className="w-6 h-6 text-slate-400 animate-spin" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
        <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-75" />
      </svg>
    </div>
  );
}

function DocError() {
  return (
    <div className="flex flex-col items-center justify-center gap-2 h-64 text-slate-400 text-sm">
      <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
        <polyline points="14 2 14 8 20 8" />
      </svg>
      <p>Could not load document</p>
    </div>
  );
}
