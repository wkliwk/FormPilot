"use client";

import { useState } from "react";

export interface MappingRow {
  fieldId: string;
  fieldLabel: string;
  value: string;
  profileKey: string | undefined;
  profileLabel: string | undefined;
  confidence: number;
  suggestedAlternatives: Array<{
    profileKey: string;
    profileLabel: string;
    value: string;
  }>;
}

interface Props {
  formId: string;
  mapping: MappingRow[];
  onAccept: (values: Record<string, string>) => void;
  onClose: () => void;
}

function confidenceBadge(confidence: number) {
  const pct = Math.round(confidence * 100);
  if (confidence >= 0.8) return { label: `${pct}%`, className: "bg-emerald-100 text-emerald-700" };
  if (confidence >= 0.5) return { label: `${pct}%`, className: "bg-amber-100 text-amber-700" };
  return { label: `${pct}%`, className: "bg-red-100 text-red-700" };
}

export default function FieldMappingEditor({ mapping, onAccept, onClose }: Props) {
  // Local state: current selected source value per field
  const [localValues, setLocalValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(mapping.map((row) => [row.fieldId, row.value ?? ""]))
  );

  function handleSourceChange(fieldId: string, newValue: string) {
    setLocalValues((prev) => ({ ...prev, [fieldId]: newValue }));
  }

  function handleAcceptAll() {
    onAccept(localValues);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={onClose}
      aria-hidden="true"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="mapping-editor-title"
        className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <div>
            <h2 id="mapping-editor-title" className="font-semibold text-slate-900">Review Autofill Mapping</h2>
            <p className="text-xs text-slate-500 mt-0.5">Check the source for each field. Change if incorrect before accepting.</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600"
            aria-label="Close mapping editor"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Table */}
        <div className="overflow-y-auto flex-1 px-6 py-4">
          {mapping.length === 0 ? (
            <p className="text-sm text-slate-500 py-6 text-center">No autofilled fields to review.</p>
          ) : (
            <table className="w-full text-sm" role="table">
              <thead>
                <tr className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide border-b border-slate-100">
                  <th className="pb-2 pr-4 font-semibold">Form Field</th>
                  <th className="pb-2 pr-4 font-semibold">Source</th>
                  <th className="pb-2 pr-4 font-semibold">Value</th>
                  <th className="pb-2 font-semibold">Confidence</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {mapping.map((row) => {
                  const badge = confidenceBadge(row.confidence);
                  const allOptions = [
                    { profileKey: row.profileKey ?? "", profileLabel: row.profileLabel ?? row.profileKey ?? "", value: row.value ?? "" },
                    ...row.suggestedAlternatives.filter((a) => a.profileKey !== row.profileKey),
                  ];
                  const selectedValue = localValues[row.fieldId] ?? "";

                  return (
                    <tr key={row.fieldId} className="align-top">
                      <td className="py-3 pr-4 font-medium text-slate-800 max-w-[180px] truncate" title={row.fieldLabel}>
                        {row.fieldLabel}
                      </td>
                      <td className="py-3 pr-4">
                        {allOptions.length > 1 ? (
                          <select
                            value={selectedValue}
                            onChange={(e) => handleSourceChange(row.fieldId, e.target.value)}
                            className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 max-w-[160px]"
                            aria-label={`Source for ${row.fieldLabel}`}
                          >
                            {allOptions.map((opt) => (
                              <option key={opt.profileKey} value={opt.value}>
                                {opt.profileLabel}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-xs text-slate-600">{row.profileLabel}</span>
                        )}
                      </td>
                      <td className="py-3 pr-4 text-slate-700 max-w-[200px] truncate font-mono text-xs" title={selectedValue}>
                        {selectedValue || <span className="text-slate-400 italic">empty</span>}
                      </td>
                      <td className="py-3">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${badge.className}`}>
                          {badge.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
          >
            Skip
          </button>
          <button
            onClick={handleAcceptAll}
            className="px-5 py-2 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Accept All
          </button>
        </div>
      </div>
    </div>
  );
}
