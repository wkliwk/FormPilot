"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type { FormField, FieldState } from "@/lib/ai/analyze-form";
import type { ValidationResult } from "@/lib/validation/validate-form";
import { validateForm } from "@/lib/validation/validate-form";
import { validateFieldFormat } from "@/lib/validation/field-rules";
import { generateSampleValue } from "@/lib/sample-data";
import { CONFIDENCE_REVIEW_THRESHOLD } from "@/lib/constants";
import ExportPreviewModal, { type ExportFormat } from "./ExportPreviewModal";
import ConfidenceReviewPanel from "./ConfidenceReviewPanel";
import FieldQA from "./FieldQA";
import ProGateModal from "@/components/ProGateModal";
import FieldNote from "./FieldNote";
import GapReportPanel, { type ProfileGap } from "./GapReportPanel";
import ProgressRing from "./ProgressRing";
import ShareModal from "./ShareModal";
import FieldMappingEditor, { type MappingRow } from "./FieldMappingEditor";
import UpgradeGateModal from "@/components/UpgradeGateModal";

interface FormRecord {
  id: string;
  title: string;
  status: string;
  fields: unknown;
  version?: number;
}

interface Props {
  form: FormRecord;
  hasProfile: boolean;
  /** Called when a field input is focused — passes the field id. */
  onFieldFocus?: (fieldId: string | null) => void;
  /** Called on every keystroke with the updated field id + value (for live overlay). */
  onValueChange?: (fieldId: string, value: string) => void;
  /** Called with full values snapshot after batch operations (autofill, clear, sample). */
  onValuesSnapshotChange?: (values: Record<string, string>) => void;
  /** Whether there is a file stored (used for export preview). */
  hasFile?: boolean;
  /** Source type of the form (PDF, WORD, etc). */
  sourceType?: string;
  /** Called after a successful title save — passes the new title. */
  onTitleChange?: (newTitle: string) => void;
  /** Called after form status is PATCHed to COMPLETED. */
  onComplete?: () => void;
  /** Jump-to-field request from the document viewer. */
  jumpToFieldRequest?: { fieldId: string; nonce: number } | null;
  /** Active language code for translations. */
  language?: string;
  /** Called whenever the save status changes — passes status and the timestamp of the last successful save. */
  onSaveStatusChange?: (status: "idle" | "saving" | "saved" | "error", savedAt: Date | null) => void;
  /** Whether the user has a Pro plan (enables Pro-only export formats). */
  isPro?: boolean;
  /** True when free-tier user has reached their monthly upload limit — triggers upgrade nudge at export. */
  isAtFreeLimit?: boolean;
  /** Per-field private notes — keyed by fieldId. */
  fieldNotes?: Record<string, string>;
  /** Called after a note is saved or deleted — used to keep parent notepad indicators in sync. */
  onNoteChange?: (fieldId: string, note: string | null) => void;
}

// -- Certificate download button (Pro-gated) --

function CertificateButton({ formId, isPro }: { formId: string; isPro?: boolean }) {
  const [downloading, setDownloading] = useState(false);

  async function handleDownload() {
    if (!isPro) return; // ProGateModal handles the gate
    setDownloading(true);
    try {
      const res = await fetch(`/api/forms/${formId}/certificate`);
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download =
        res.headers.get("Content-Disposition")?.split("filename=")[1]?.replace(/"/g, "") ??
        "certificate.pdf";
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <ProGateModal
      feature="Completion Certificate"
      benefit="Download a professional PDF certificate listing all filled fields — perfect for attaching to immigration, HR, or legal submissions."
      isPro={!!isPro}
    >
      <button
        onClick={handleDownload}
        disabled={downloading}
        className="inline-flex items-center gap-1.5 px-4 py-2 border border-emerald-200 text-emerald-700 bg-emerald-50 text-sm rounded-lg font-medium hover:bg-emerald-100 transition-colors disabled:opacity-40 active:scale-[0.98]"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <polyline points="9 15 12 18 15 15" />
          <line x1="12" y1="12" x2="12" y2="18" />
        </svg>
        {downloading ? "Downloading..." : "Certificate"}
      </button>
    </ProGateModal>
  );
}

// -- helpers --

function confidenceTier(confidence: number): "high" | "medium" | "low" {
  if (confidence >= 0.8) return "high";
  if (confidence >= 0.5) return "medium";
  return "low";
}

const tierConfig = {
  high: {
    badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
    bar: "bg-emerald-500",
    border: "border-emerald-200",
    inputBg: "bg-emerald-50/50",
    label: "High match",
  },
  medium: {
    badge: "bg-amber-50 text-amber-700 border-amber-200",
    bar: "bg-amber-500",
    border: "border-amber-200",
    inputBg: "bg-amber-50/50",
    label: "Partial match",
  },
  low: {
    badge: "bg-red-50 text-red-600 border-red-200",
    bar: "bg-red-500",
    border: "border-red-200",
    inputBg: "bg-red-50/50",
    label: "Low match",
  },
} as const;

// -- component --

export default function FormViewer({ form, hasProfile, onFieldFocus, onValueChange, onValuesSnapshotChange, hasFile, sourceType, onTitleChange, onComplete, onSaveStatusChange, isPro, isAtFreeLimit, fieldNotes, onNoteChange }: Props) {
  const initialFields = form.fields as FormField[];

  const [fields] = useState<FormField[]>(initialFields);
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(
      initialFields.filter((f) => f.value).map((f) => [f.id, f.value!])
    )
  );
  const [fieldStates, setFieldStates] = useState<Record<string, FieldState>>(
    Object.fromEntries(
      initialFields.filter((f) => f.fieldState).map((f) => [f.id, f.fieldState!])
    )
  );
  const [expandedExplanations, setExpandedExplanations] = useState<Set<string>>(new Set());
  const [autofilling, setAutofilling] = useState(false);
  const [autofillError, setAutofillError] = useState<string | null>(null);
  const [autofillConflict, setAutofillConflict] = useState(false);
  const [profileGaps, setProfileGaps] = useState<ProfileGap[]>([]);
  const [gapReportVisible, setGapReportVisible] = useState(false);

  // Live completion score — recomputed whenever values change
  const completionScore = fields.length > 0
    ? Math.round(Object.values(values).filter((v) => v && String(v).trim()).length / fields.length * 100)
    : -1; // -1 = unknown field count, hide ring

  const [saveError, setSaveError] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [activeField, setActiveField] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [savedAt, setSavedAt] = useState<Date | null>(() =>
    // If the form already has field values on mount, treat it as already saved
    (form.fields as FormField[]).some((f) => f.value) ? new Date() : null
  );
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [showForceExportDialog, setShowForceExportDialog] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [showExportUpgradeModal, setShowExportUpgradeModal] = useState(false);
  const [showConfidenceReview, setShowConfidenceReview] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [priorFormOffer, setPriorFormOffer] = useState<{ id: string; title: string } | null>(null);
  const [applyingPriorFill, setApplyingPriorFill] = useState(false);
  const [sampleFilling, setSampleFilling] = useState(false);
  const [sampleFillMessage, setSampleFillMessage] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(form.title);
  // per-field AI suggestions
  const [suggestingFields, setSuggestingFields] = useState<Set<string>>(new Set());
  const [fieldSuggestions, setFieldSuggestions] = useState<Record<string, { value: string; source: string; sourceType?: "memory" | "history" } | { error: true } | null>>({});
  // correction toasts — fieldId → "pending" | "saving" | "saved" | "dismissed"
  const [correctionToasts, setCorrectionToasts] = useState<Record<string, "pending" | "saving" | "saved" | "dismissed">>({});
  // blur-based inline validation errors — fieldId → error message string
  const [blurErrors, setBlurErrors] = useState<Record<string, string>>({});
  // export pre-flight: required-fields-empty banner
  const [showRequiredEmptyBanner, setShowRequiredEmptyBanner] = useState(false);
  // autofill confidence summary banner
  const [autofillSummary, setAutofillSummary] = useState<{ high: number; medium: number; low: number; unfilled: number } | null>(null);
  // field mapping editor
  const [mappingRows, setMappingRows] = useState<MappingRow[] | null>(null);
  const [mappingLoading, setMappingLoading] = useState(false);
  const [upgradeGateFeature, setUpgradeGateFeature] = useState<string | null>(null);
  // skipped fields after autofill — required fields autofill could not fill
  type SkippedField = { id: string; label: string; reason: "low_confidence" | "missing_profile_data" | "type_mismatch" | "timeout" };
  const [skippedFields, setSkippedFields] = useState<SkippedField[]>([]);
  // undo autofill — snapshot taken before each autofill, cleared on field edit or after 8s
  const preAutofillSnapshot = useRef<{ values: Record<string, string>; fieldStates: Record<string, FieldState> } | null>(null);
  const [showUndoToast, setShowUndoToast] = useState(false);
  const [undoConfirmFlash, setUndoConfirmFlash] = useState(false);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // help drawer
  const [helpDrawerFieldId, setHelpDrawerFieldId] = useState<string | null>(null);
  type ExplainResult = { explanation: string; example: string; commonMistakes: string | null; whereToFind: string | null; isPro: boolean; remaining: number };
  const [helpCache, setHelpCache] = useState<Record<string, ExplainResult | "loading" | "error">>({});
  const helpDrawerRef = useRef<HTMLDivElement>(null);
  // Track which button triggered the help drawer so focus can return on close
  const helpTriggerRef = useRef<HTMLButtonElement | null>(null);
  // original autofilled values keyed by fieldId — set once on mount, never updated
  const originalAutofillValues = useRef<Record<string, string>>(
    Object.fromEntries(
      initialFields
        .filter((f) => f.value && f.confidence !== undefined && f.confidence > 0)
        .map((f) => [f.id, f.value!])
    )
  );
  // keyboard navigation for unanswered fields
  const [currentUnansweredIndex, setCurrentUnansweredIndex] = useState(0);
  // field currently flashing the highlight ring (cleared after animation ends)
  const [highlightedFieldId, setHighlightedFieldId] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const titleSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Notify parent of initial saved state on mount (if the form already has values)
  useEffect(() => {
    if (savedAt) {
      onSaveStatusChange?.("saved", savedAt);
    }
    // Only run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // -- persistence --

  const scheduleSave = useCallback(
    (newValues: Record<string, string>, newStates: Record<string, FieldState>) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      setSaveStatus("saving");
      onSaveStatusChange?.("saving", null);
      saveTimer.current = setTimeout(async () => {
        try {
          const allFieldIds = new Set([
            ...Object.keys(newValues),
            ...Object.keys(newStates),
          ]);
          const fieldUpdates = Array.from(allFieldIds).map((id) => ({
            id,
            ...(id in newValues ? { value: newValues[id] } : {}),
            ...(id in newStates ? { fieldState: newStates[id] } : {}),
          }));
          await fetch(`/api/forms/${form.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ fields: fieldUpdates, status: "FILLING" }),
          });
          const now = new Date();
          setSaveStatus("saved");
          setSavedAt(now);
          setSaveError(false);
          onSaveStatusChange?.("saved", now);
        } catch {
          setSaveStatus("error");
          setSaveError(true);
          onSaveStatusChange?.("error", null);
        }
      }, 800);
    },
    [form.id, onSaveStatusChange]
  );

  // -- field actions --

  function handleValueChange(fieldId: string, value: string) {
    const newValues = { ...values, [fieldId]: value };
    setValues(newValues);
    scheduleSave(newValues, fieldStates);
    onValueChange?.(fieldId, value);
    // Clear blur error as soon as the user starts correcting
    if (blurErrors[fieldId]) {
      setBlurErrors((prev) => { const next = { ...prev }; delete next[fieldId]; return next; });
    }
    // Manual edit after autofill = implicit acceptance; invalidate undo snapshot
    if (showUndoToast) {
      setShowUndoToast(false);
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
      preAutofillSnapshot.current = null;
    }
  }

  function handleUndoAutofill() {
    const snapshot = preAutofillSnapshot.current;
    if (!snapshot) return;
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    setShowUndoToast(false);
    preAutofillSnapshot.current = null;
    setValues(snapshot.values);
    setFieldStates(snapshot.fieldStates);
    setAutofillSummary(null);
    setSkippedFields([]);
    scheduleSave(snapshot.values, snapshot.fieldStates);
    setUndoConfirmFlash(true);
    setTimeout(() => setUndoConfirmFlash(false), 2000);
  }

  function handleAccept(fieldId: string) {
    const newStates = { ...fieldStates, [fieldId]: "accepted" as FieldState };
    setFieldStates(newStates);
    scheduleSave(values, newStates);
  }

  function handleReject(fieldId: string) {
    const newStates = { ...fieldStates, [fieldId]: "rejected" as FieldState };
    const newValues = { ...values };
    delete newValues[fieldId];
    setValues(newValues);
    setFieldStates(newStates);
    scheduleSave(newValues, newStates);
  }

  function handleUndoReject(fieldId: string) {
    const newStates = { ...fieldStates };
    delete newStates[fieldId];
    setFieldStates(newStates);
    scheduleSave(values, newStates);
  }

  function handleUnlock(fieldId: string) {
    const newStates = { ...fieldStates, [fieldId]: "pending" as FieldState };
    setFieldStates(newStates);
    scheduleSave(values, newStates);
  }

  async function fetchFieldSuggestion(fieldId: string) {
    if (suggestingFields.has(fieldId)) return;
    setSuggestingFields((prev) => new Set(prev).add(fieldId));
    try {
      const res = await fetch(`/api/forms/${form.id}/suggestions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fieldId }),
      });
      if (!res.ok) throw new Error("Request failed");
      const data = await res.json() as { suggestion: { value: string; source: string; sourceType?: "memory" | "history" } | null };
      setFieldSuggestions((prev) => ({ ...prev, [fieldId]: data.suggestion }));
    } catch {
      setFieldSuggestions((prev) => ({ ...prev, [fieldId]: { error: true } }));
    } finally {
      setSuggestingFields((prev) => { const next = new Set(prev); next.delete(fieldId); return next; });
    }
  }

  function handleAcceptSuggestion(fieldId: string) {
    const suggestion = fieldSuggestions[fieldId];
    if (!suggestion || "error" in suggestion) return;
    const newValues = { ...values, [fieldId]: suggestion.value };
    const newStates = { ...fieldStates, [fieldId]: "pending" as FieldState };
    setValues(newValues);
    setFieldStates(newStates);
    scheduleSave(newValues, newStates);
    onValueChange?.(fieldId, suggestion.value);
    setFieldSuggestions((prev) => { const next = { ...prev }; delete next[fieldId]; return next; });
  }

  function dismissSuggestion(fieldId: string) {
    setFieldSuggestions((prev) => { const next = { ...prev }; delete next[fieldId]; return next; });
  }

  // -- correction handling --

  function handleFieldBlurForCorrection(fieldId: string, fieldLabel: string) {
    const currentValue = values[fieldId];
    const originalValue = originalAutofillValues.current[fieldId];
    // Only prompt if: field was autofilled, value changed, toast not already shown/dismissed
    if (
      originalValue !== undefined &&
      currentValue &&
      currentValue !== originalValue &&
      correctionToasts[fieldId] === undefined
    ) {
      setCorrectionToasts((prev) => ({ ...prev, [fieldId]: "pending" }));
      // Store label for the save action
      originalAutofillValues.current[`${fieldId}__label`] = fieldLabel;
    }
  }

  function dismissCorrectionToast(fieldId: string) {
    setCorrectionToasts((prev) => ({ ...prev, [fieldId]: "dismissed" }));
  }

  async function saveCorrection(fieldId: string) {
    const fieldLabel = originalAutofillValues.current[`${fieldId}__label`] ?? "";
    const value = values[fieldId];
    if (!fieldLabel || !value) {
      dismissCorrectionToast(fieldId);
      return;
    }
    setCorrectionToasts((prev) => ({ ...prev, [fieldId]: "saving" }));
    try {
      await fetch("/api/corrections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fieldLabel, value }),
      });
      setCorrectionToasts((prev) => ({ ...prev, [fieldId]: "saved" }));
      setTimeout(() => {
        setCorrectionToasts((prev) => ({ ...prev, [fieldId]: "dismissed" }));
      }, 2000);
    } catch {
      dismissCorrectionToast(fieldId);
    }
  }

  // -- help drawer --

  async function openHelp(fieldId: string, triggerEl?: HTMLButtonElement | null) {
    helpTriggerRef.current = triggerEl ?? null;
    setHelpDrawerFieldId(fieldId);
    if (helpCache[fieldId]) return; // already cached or loading

    setHelpCache((prev) => ({ ...prev, [fieldId]: "loading" }));
    try {
      const res = await fetch(`/api/forms/${form.id}/fields/${fieldId}/explain`, { method: "POST" });
      if (!res.ok) throw new Error("explain failed");
      const data = await res.json() as { explanation: string; example: string; commonMistakes: string | null; whereToFind: string | null; isPro: boolean; remaining: number };
      setHelpCache((prev) => ({ ...prev, [fieldId]: data }));
    } catch {
      setHelpCache((prev) => ({ ...prev, [fieldId]: "error" }));
    }
  }

  function closeHelp() {
    setHelpDrawerFieldId(null);
    helpTriggerRef.current?.focus();
    helpTriggerRef.current = null;
  }

  // Help drawer: Escape to close, focus trap, move focus in on open
  useEffect(() => {
    if (!helpDrawerFieldId) return;
    const firstFocusable = helpDrawerRef.current?.querySelector<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    firstFocusable?.focus();

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        closeHelp();
        return;
      }
      if (e.key !== "Tab" || !helpDrawerRef.current) return;
      const all = Array.from(
        helpDrawerRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => !el.hasAttribute("disabled"));
      if (all.length === 0) return;
      const first = all[0];
      const last = all[all.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [helpDrawerFieldId]);

  function handleAcceptAllHigh() {
    const newStates = { ...fieldStates };
    for (const field of fields) {
      if (
        field.confidence !== undefined &&
        field.confidence > 0.8 &&
        values[field.id] &&
        fieldStates[field.id] !== "rejected"
      ) {
        newStates[field.id] = "accepted";
      }
    }
    setFieldStates(newStates);
    scheduleSave(values, newStates);
  }

  function toggleExplanation(fieldId: string) {
    setExpandedExplanations((prev) => {
      const next = new Set(prev);
      if (next.has(fieldId)) {
        next.delete(fieldId);
      } else {
        next.add(fieldId);
      }
      return next;
    });
  }

  // -- title editing --

  function handleTitleClick() {
    setEditingTitle(true);
    setTitleDraft(form.title);
    // Auto-focus the input after state update
    setTimeout(() => titleInputRef.current?.focus(), 0);
  }

  async function saveTitle(newTitle: string) {
    const trimmed = newTitle.trim();
    if (!trimmed) {
      // Empty title — revert
      setEditingTitle(false);
      setTitleDraft(form.title);
      return;
    }

    setEditingTitle(false);
    setSaveStatus("saving");
    onSaveStatusChange?.("saving", null);

    try {
      const res = await fetch(`/api/forms/${form.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: trimmed }),
      });

      if (!res.ok) throw new Error("Failed to save title");

      // Update form title in state
      form.title = trimmed;
      setTitleDraft(trimmed);
      onTitleChange?.(trimmed);

      // Show "Saved" confirmation
      const now = new Date();
      setSaveStatus("saved");
      setSavedAt(now);
      onSaveStatusChange?.("saved", now);
      if (titleSaveTimer.current) clearTimeout(titleSaveTimer.current);
      titleSaveTimer.current = setTimeout(() => setSaveStatus("idle"), 2000);
    } catch {
      setSaveStatus("idle");
      setEditingTitle(true);
    }
  }

  function handleTitleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      saveTitle(titleDraft);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setEditingTitle(false);
      setTitleDraft(form.title);
    }
  }

  function handleTitleBlur() {
    saveTitle(titleDraft);
  }

  // -- autofill --

  async function handleAutofill() {
    setAutofilling(true);
    setAutofillError(null);
    setAutofillConflict(false);
    // Snapshot current state for undo — overwrite any previous snapshot
    preAutofillSnapshot.current = { values: { ...values }, fieldStates: { ...fieldStates } };
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    setShowUndoToast(false);
    try {
      const res = await fetch(`/api/forms/${form.id}/autofill`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expectedVersion: form.version ?? 0 }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string; retryAfter?: number; message?: string };
        if (data.error === "conflict") {
          setAutofillConflict(true);
          return;
        }
        if (data.error === "rate_limited") {
          const seconds = typeof data.retryAfter === "number" ? data.retryAfter : 60;
          throw new Error(`Our AI is busy right now. Please try again in ${seconds} seconds.`);
        }
        if (data.error === "ai_unavailable") {
          throw new Error("AI analysis is temporarily unavailable. Please try again in a few minutes.");
        }
        if (data.error === "analysis_failed") {
          throw new Error("Analysis failed. Please try again or contact support.");
        }
        throw new Error("Autofill failed");
      }
      const data = await res.json();
      const newFields: FormField[] = data.fields;
      const newValues = Object.fromEntries(
        newFields.filter((f) => f.value).map((f) => [f.id, f.value!])
      );
      const newStates: Record<string, FieldState> = { ...fieldStates };
      for (const f of newFields) {
        if (f.value && !newStates[f.id]) {
          newStates[f.id] = "pending";
        }
      }
      setValues(newValues);
      setFieldStates(newStates);
      scheduleSave(newValues, newStates);

      // Compute confidence summary for the post-autofill banner
      const filledFields = newFields.filter((f) => f.value);
      if (filledFields.length > 0) {
        const highCount = filledFields.filter((f) => f.confidence !== undefined && f.confidence >= 0.8).length;
        const mediumCount = filledFields.filter((f) => f.confidence !== undefined && f.confidence >= 0.5 && f.confidence < 0.8).length;
        const lowCount = filledFields.filter((f) => f.confidence !== undefined && f.confidence < 0.5).length;
        const unfilledCount = newFields.filter((f) => !f.value).length;
        // Only show banner if there are medium or low confidence fills (all-high is fine, no banner needed)
        if (mediumCount > 0 || lowCount > 0) {
          setAutofillSummary({ high: highCount, medium: mediumCount, low: lowCount, unfilled: unfilledCount });
        }
      }

      // Show undo toast for 8 seconds
      setShowUndoToast(true);
      undoTimerRef.current = setTimeout(() => {
        setShowUndoToast(false);
        preAutofillSnapshot.current = null;
      }, 8000);

      // Set skipped fields banner (required fields autofill could not fill)
      const skipped = (data.skipped_fields ?? []) as SkippedField[];
      setSkippedFields(skipped);

      // Show gap report if there are unmatched profile fields and user hasn't dismissed it
      const gaps: ProfileGap[] = data.profileGaps ?? [];
      const dismissKey = `gapReportDismissed:${form.id}`;
      const dismissed = typeof window !== "undefined" && localStorage.getItem(dismissKey);
      if (gaps.length > 0 && !dismissed) {
        setProfileGaps(gaps);
        setGapReportVisible(true);
      }
    } catch (err) {
      setAutofillError(err instanceof Error ? err.message : "Autofill is temporarily unavailable — please try again in a moment.");
    } finally {
      setAutofilling(false);
    }
  }

  // -- field mapping editor --

  async function openMappingEditor() {
    if (!isPro) {
      setUpgradeGateFeature("Field Mapping Editor");
      return;
    }
    setMappingLoading(true);
    try {
      const res = await fetch(`/api/forms/${form.id}/autofill/mapping`);
      const data = await res.json() as { mapping?: MappingRow[] };
      setMappingRows(data.mapping ?? []);
    } catch {
      setMappingRows([]);
    } finally {
      setMappingLoading(false);
    }
  }

  function handleMappingAccept(updatedValues: Record<string, string>) {
    const newValues = { ...values, ...updatedValues };
    const newStates = { ...fieldStates };
    for (const fieldId of Object.keys(updatedValues)) {
      newStates[fieldId] = "pending";
    }
    setValues(newValues);
    setFieldStates(newStates);
    scheduleSave(newValues, newStates);
    setMappingRows(null);
  }

  // -- clear all --

  async function handleClearAll() {
    if (!window.confirm("Clear all filled values and reset review states? This cannot be undone.")) return;

    const clearValues: Record<string, string> = {};
    const clearStates: Record<string, FieldState> = {};

    setValues(clearValues);
    setFieldStates(clearStates);
    setAutofillSummary(null);
    setSkippedFields([]);
    onValuesSnapshotChange?.(clearValues);

    setSaveStatus("saving");
    onSaveStatusChange?.("saving", null);
    try {
      const fieldUpdates = fields.map((f) => ({ id: f.id, value: "", fieldState: "pending" as FieldState }));
      await fetch(`/api/forms/${form.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields: fieldUpdates, status: "FILLING" }),
      });
      const now = new Date();
      setSaveStatus("saved");
      setSavedAt(now);
      setSaveError(false);
      onSaveStatusChange?.("saved", now);
    } catch {
      setSaveStatus("error");
      setSaveError(true);
      onSaveStatusChange?.("error", null);
    }
  }

  // -- validation --

  function handleValidate() {
    const result = validateForm(fields, values, fieldStates as Record<string, string>);
    setValidation(result);
  }

  // -- export --

  async function doExport(force = false, format: ExportFormat = "pdf") {
    setExporting(true);
    setShowForceExportDialog(false);
    try {
      const params = new URLSearchParams();
      if (force) params.set("force", "true");
      if (format === "docx") params.set("format", "docx");
      const url = `/api/forms/${form.id}/export?${params.toString()}`;
      const res = await fetch(url);

      if (res.status === 422) {
        // Server-side validation failed — show force dialog
        const data = await res.json();
        setValidation(data.validation);
        setShowForceExportDialog(true);
        return;
      }

      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download =
        res.headers.get("Content-Disposition")?.split("filename=")[1]?.replace(/"/g, "") ??
        "form_filled.json";
      a.click();
      URL.revokeObjectURL(blobUrl);

      // Celebrate successful export — skip if user prefers reduced motion
      if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        import("canvas-confetti").then(({ default: confetti }) => {
          confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 }, colors: ["#2563eb", "#7c3aed", "#10b981", "#f59e0b"] });
        });
      }
    } finally {
      setExporting(false);
    }
  }

  async function handleMarkComplete() {
    await fetch(`/api/forms/${form.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "COMPLETED" }),
    });
    onComplete?.();
  }

  function navigateToFirstEmptyRequired() {
    const firstId = emptyRequiredFieldIds[0];
    if (!firstId) return;
    const el = document.getElementById(`field-${firstId}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.focus();
    }
    setHighlightedFieldId(null);
    requestAnimationFrame(() => setHighlightedFieldId(firstId));
  }

  async function handleExport() {
    // Intercept for free-tier users who've hit their upload limit — show upgrade nudge
    if (!isPro && isAtFreeLimit) {
      setShowExportUpgradeModal(true);
      return;
    }

    // Run client-side validation first for instant feedback
    const result = validateForm(fields, values, fieldStates as Record<string, string>);
    setValidation(result);

    if (!result.valid) {
      // Scroll to and focus the first invalid field so users can fix it in context
      const firstErrorId = result.errors[0]?.fieldId;
      if (firstErrorId) {
        const el = document.getElementById(`field-${firstErrorId}`);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          el.focus();
        }
      }
      setShowForceExportDialog(true);
      return;
    }

    // Non-blocking required-field pre-flight: warn but allow export
    if (emptyRequiredCount > 0) {
      setShowRequiredEmptyBanner(true);
    }

    // Show preview modal before actual export
    setShowPreviewModal(true);
  }

  async function handleConfirmExport(format: ExportFormat) {
    if (format === "clipboard") {
      // Build plain-text representation of filled fields and copy to clipboard
      const lines = fields
        .filter((f) => values[f.id])
        .map((f) => `${f.label}: ${values[f.id]}`);
      await navigator.clipboard.writeText(lines.join("\n")).catch(() => {});
      setShowPreviewModal(false);
      return;
    }
    await doExport(false, format);
    setShowPreviewModal(false);
  }

  // -- sample fill --

  async function handleSampleFill() {
    setSampleFilling(true);
    setSampleFillMessage(null);
    try {
      const res = await fetch(`/api/forms/${form.id}/sample-fill`, { method: "POST" });
      if (!res.ok) throw new Error("Sample fill failed");
      const data = await res.json() as { values: Record<string, string> };
      const newValues = { ...values, ...data.values };
      const newStates: Record<string, FieldState> = { ...fieldStates };
      setValues(newValues);
      setFieldStates(newStates);
      scheduleSave(newValues, newStates);
      setSampleFillMessage("Fields filled with sample data");
      setTimeout(() => setSampleFillMessage(null), 3000);
    } catch {
      setSampleFillMessage("Failed to fill sample data");
      setTimeout(() => setSampleFillMessage(null), 3000);
    } finally {
      setSampleFilling(false);
    }
  }

  // -- keyboard navigation --

  // Get list of unfilled field IDs: no value AND fieldState is not "accepted"
  const unansweredFieldIds = fields
    .filter((f) => (!values[f.id] || values[f.id] === "") && fieldStates[f.id] !== "accepted")
    .map((f) => f.id);

  const unansweredCount = unansweredFieldIds.length;

  // Navigate to an unanswered field by index (wraps around)
  const navigateToUnansweredField = useCallback((index: number) => {
    if (unansweredFieldIds.length === 0) return;
    // Wrap-around
    const wrappedIndex = ((index % unansweredFieldIds.length) + unansweredFieldIds.length) % unansweredFieldIds.length;
    setCurrentUnansweredIndex(wrappedIndex);
    const fieldId = unansweredFieldIds[wrappedIndex];
    const element = document.getElementById(`field-${fieldId}`);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "center" });
      element.focus();
    }
    // Trigger highlight ring animation — clear first to allow re-trigger on same field
    setHighlightedFieldId(null);
    requestAnimationFrame(() => setHighlightedFieldId(fieldId));
  }, [unansweredFieldIds]);

  // Handle keyboard shortcuts: Alt+N / Alt+P (legacy) + N / ] when not in an input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (unansweredCount === 0) return;

      if (e.altKey && e.key === "n") {
        e.preventDefault();
        navigateToUnansweredField(currentUnansweredIndex + 1);
        return;
      }
      if (e.altKey && e.key === "p") {
        e.preventDefault();
        navigateToUnansweredField(currentUnansweredIndex - 1);
        return;
      }

      // N or ] advances to next empty field — but only when focus is NOT inside a text input/textarea/select
      const tag = (e.target as HTMLElement)?.tagName;
      const isEditable = (e.target as HTMLElement)?.isContentEditable;
      const isInputFocused = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || isEditable;
      if (!isInputFocused && !e.altKey && !e.ctrlKey && !e.metaKey) {
        if (e.key === "n" || e.key === "N" || e.key === "]") {
          e.preventDefault();
          navigateToUnansweredField(currentUnansweredIndex + 1);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentUnansweredIndex, unansweredCount, navigateToUnansweredField]);

  // -- prior form offer --

  // Auto-dismiss the skipped-fields banner once all previously-skipped fields have been filled by the user
  useEffect(() => {
    if (skippedFields.length === 0) return;
    const allFilled = skippedFields.every((sf) => values[sf.id] && String(values[sf.id]).trim());
    if (allFilled) setSkippedFields([]);
  }, [values, skippedFields]);

  useEffect(() => {
    const dismissKey = `preFillDismissed:${form.id}`;
    if (typeof window !== "undefined" && localStorage.getItem(dismissKey)) return;
    // Only show if there are no values yet (fresh form)
    const hasAnyValue = fields.some((f) => values[f.id]);
    if (hasAnyValue) return;

    fetch(`/api/forms/${form.id}/prior-form`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.priorForm) setPriorFormOffer(data.priorForm);
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.id]);

  async function handleApplyPriorFill() {
    if (!priorFormOffer) return;
    setApplyingPriorFill(true);
    try {
      const res = await fetch(`/api/forms/${form.id}/re-fill`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceFormId: priorFormOffer.id }),
      });
      if (!res.ok) throw new Error("Re-fill failed");
      const data = await res.json();
      const newFields: FormField[] = data.fields;
      const newValues = Object.fromEntries(
        newFields.filter((f) => f.value).map((f) => [f.id, f.value!])
      );
      const newStates: Record<string, FieldState> = { ...fieldStates };
      for (const f of newFields) {
        if (f.value && !newStates[f.id]) {
          newStates[f.id] = "pending";
        }
      }
      setValues(newValues);
      setFieldStates(newStates);
      scheduleSave(newValues, newStates);
      setPriorFormOffer(null);
    } catch {
      // Silent — leave offer visible so user can retry
    } finally {
      setApplyingPriorFill(false);
    }
  }

  function handleDismissPriorFill() {
    if (typeof window !== "undefined") {
      localStorage.setItem(`preFillDismissed:${form.id}`, "1");
    }
    setPriorFormOffer(null);
  }

  // -- derived --

  const filledCount = fields.filter((f) => values[f.id]).length;
  const acceptedCount = fields.filter((f) => fieldStates[f.id] === "accepted").length;
  const progress = fields.length > 0 ? Math.round((filledCount / fields.length) * 100) : 0;

  // Required fields that have no value and are not accepted
  const emptyRequiredFieldIds = fields
    .filter((f) => f.required && fieldStates[f.id] !== "accepted" && !values[f.id])
    .map((f) => f.id);
  const emptyRequiredCount = emptyRequiredFieldIds.length;

  // Fields with AI confidence below review threshold that have been filled
  const uncertainFieldCount = fields.filter(
    (f) => f.confidence !== undefined && f.confidence < CONFIDENCE_REVIEW_THRESHOLD && values[f.id]
  ).length;

  // Build set of field IDs with validation errors for inline indicators
  const errorFieldIds = new Set(validation?.errors.map((e) => e.fieldId) ?? []);
  const warningFieldIds = new Set(validation?.warnings.filter((w) => w.rule === "low_confidence").map((w) => w.fieldId) ?? []);
  const highConfidencePendingCount = fields.filter(
    (f) =>
      f.confidence !== undefined &&
      f.confidence > 0.8 &&
      values[f.id] &&
      fieldStates[f.id] !== "accepted" &&
      fieldStates[f.id] !== "rejected"
  ).length;

  // -- render --

  return (
    <>
    {/* Export upgrade nudge — shown to free-tier users at their limit */}
    {showExportUpgradeModal && (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
        onClick={(e) => { if (e.target === e.currentTarget) setShowExportUpgradeModal(false); }}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="export-upgrade-title"
          className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8"
        >
          <div className="flex flex-col items-center text-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center">
              <svg className="w-7 h-7 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            </div>
            <div>
              <h2 id="export-upgrade-title" className="text-lg font-semibold text-slate-900">
                Your form is ready to export
              </h2>
              <p className="text-slate-500 mt-2 text-sm">
                You&apos;ve used all your free form slots this month. Upgrade to Pro to export this form and upload as many as you need.
              </p>
            </div>

            <div className="w-full bg-slate-50 rounded-xl p-4 text-left space-y-2">
              {[
                "Unlimited form uploads & exports",
                "Priority AI processing",
                "Pro-only export formats (Word, clipboard)",
                "Completion certificates",
              ].map((benefit) => (
                <div key={benefit} className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-blue-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span className="text-sm text-slate-700">{benefit}</span>
                </div>
              ))}
            </div>

            <a
              href="/dashboard/billing"
              className="w-full py-3 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-all text-center active:scale-[0.98]"
            >
              Upgrade to Pro
            </a>

            <button
              onClick={() => setShowExportUpgradeModal(false)}
              className="text-sm text-slate-500 hover:text-slate-700 transition-colors"
            >
              Save my progress and come back later
            </button>
          </div>
        </div>
      </div>
    )}
    {showPreviewModal && (
      <ExportPreviewModal
        formId={form.id}
        formTitle={form.title}
        fields={fields}
        values={values}
        hasFile={hasFile ?? false}
        sourceType={sourceType}
        isPro={isPro}
        onConfirmExport={handleConfirmExport}
        onClose={() => setShowPreviewModal(false)}
        exporting={exporting}
      />
    )}
    {showConfidenceReview && (
      <ConfidenceReviewPanel
        fields={fields}
        values={values}
        onUpdateValue={(fieldId, value) => {
          handleValueChange(fieldId, value);
        }}
        onConfirmExport={() => {
          setShowConfidenceReview(false);
          handleExport();
        }}
        onClose={() => setShowConfidenceReview(false)}
        exporting={exporting}
      />
    )}
    {upgradeGateFeature && (
      <UpgradeGateModal
        reason="feature"
        featureName={upgradeGateFeature}
        onClose={() => setUpgradeGateFeature(null)}
      />
    )}
    {mappingRows !== null && (
      <FieldMappingEditor
        formId={form.id}
        mapping={mappingRows}
        onAccept={handleMappingAccept}
        onClose={() => setMappingRows(null)}
      />
    )}

    {/* Help drawer — right panel on desktop, bottom sheet on mobile */}
    {helpDrawerFieldId !== null && (() => {
      const helpField = fields.find((f) => f.id === helpDrawerFieldId);
      const cached = helpCache[helpDrawerFieldId];
      return (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[1px]"
            onClick={closeHelp}
            aria-hidden="true"
          />
          {/* Drawer — right side on sm+, bottom sheet on mobile */}
          <div
            ref={helpDrawerRef}
            role="dialog"
            aria-modal="true"
            aria-label={`Help for ${helpField?.label ?? "field"}`}
            className="fixed z-50 bg-white shadow-2xl
              inset-x-0 bottom-0 rounded-t-2xl max-h-[75vh] sm:max-h-none
              sm:inset-y-0 sm:right-0 sm:bottom-auto sm:top-0 sm:left-auto sm:w-80 sm:rounded-l-2xl sm:rounded-r-none
              flex flex-col overflow-hidden"
          >
            {/* Drawer header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
              <div className="min-w-0">
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Field help</p>
                <p className="text-sm font-bold text-slate-900 truncate mt-0.5">{helpField?.label}</p>
              </div>
              <button
                onClick={closeHelp}
                className="ml-3 shrink-0 text-slate-400 hover:text-slate-600 transition-colors"
                aria-label="Close help"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Drawer body */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {cached === "loading" && (
                <div className="space-y-3 animate-pulse">
                  <div className="h-3 bg-slate-100 rounded w-1/3" />
                  <div className="space-y-2">
                    <div className="h-3 bg-slate-100 rounded w-full" />
                    <div className="h-3 bg-slate-100 rounded w-4/5" />
                    <div className="h-3 bg-slate-100 rounded w-3/5" />
                  </div>
                  <div className="h-3 bg-slate-100 rounded w-1/3 mt-4" />
                  <div className="h-8 bg-slate-100 rounded w-full" />
                  <div className="h-3 bg-slate-100 rounded w-1/3 mt-4" />
                  <div className="h-3 bg-slate-100 rounded w-full" />
                </div>
              )}
              {cached === "error" && (
                <div className="text-center py-6 space-y-3">
                  <p className="text-sm text-slate-500">Could not load explanation — try again</p>
                  <button
                    onClick={() => {
                      setHelpCache((prev) => { const next = { ...prev }; delete next[helpDrawerFieldId]; return next; });
                      openHelp(helpDrawerFieldId);
                    }}
                    className="text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors"
                  >
                    Retry
                  </button>
                </div>
              )}
              {cached && cached !== "loading" && cached !== "error" && (() => {
                const result = cached as { explanation: string; example: string; commonMistakes: string | null; whereToFind: string | null; isPro: boolean; remaining: number };
                return (
                  <div className="space-y-4 text-sm">
                    <div>
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">What this means</p>
                      <p className="text-slate-700 leading-relaxed">{result.explanation}</p>
                    </div>
                    {result.example && (
                      <div>
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Example answer</p>
                        <p className="font-mono text-sm bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800">{result.example}</p>
                      </div>
                    )}
                    {result.commonMistakes && (
                      <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                        <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-1">Common mistake</p>
                        <p className="text-amber-800 leading-relaxed">{result.commonMistakes}</p>
                      </div>
                    )}
                    {result.whereToFind && (
                      <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
                        <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1">Where to find this</p>
                        <p className="text-slate-700 leading-relaxed">{result.whereToFind}</p>
                      </div>
                    )}
                    {!result.isPro && (
                      <p className="text-xs text-slate-400 pt-2 border-t border-slate-100">
                        {result.remaining} help lookups remaining this hour.{" "}
                        <a href="/dashboard/billing" className="text-blue-500 hover:text-blue-700 underline">Upgrade for unlimited.</a>
                      </p>
                    )}
                    {helpField && (
                      <FieldQA formId={form.id} fieldId={helpField.id} />
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
        </>
      );
    })()}

    <div className="space-y-6">
      {/* Header Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-soft p-5 sm:p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          {completionScore >= 0 && (
            <div className="shrink-0 self-start">
              <ProgressRing score={completionScore} size={48} strokeWidth={4} />
            </div>
          )}
          <div className="flex-1 min-w-0">
            {editingTitle ? (
              <input
                ref={titleInputRef}
                type="text"
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                onBlur={handleTitleBlur}
                onKeyDown={handleTitleKeyDown}
                className="text-xl font-bold text-slate-900 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            ) : (
              <div className="flex items-center gap-2 group cursor-pointer" onClick={handleTitleClick}>
                <h1 className="text-xl font-bold text-slate-900">{form.title}</h1>
                <svg
                  className="w-4 h-4 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.121 2.121 0 013 3L7 19H4v-3L16.5 3.5z" />
                </svg>
              </div>
            )}
            <div className="flex items-center gap-3 mt-2 text-sm text-slate-400">
              <span>{fields.length} fields</span>
              <span className="w-1 h-1 rounded-full bg-slate-300" aria-hidden="true" />
              <span>{filledCount} filled</span>
              {acceptedCount > 0 && (
                <>
                  <span className="w-1 h-1 rounded-full bg-slate-300" aria-hidden="true" />
                  <span className="text-emerald-600">{acceptedCount} accepted</span>
                </>
              )}
              {saveStatus === "saving" && (
                <span className="inline-flex items-center gap-1 text-slate-300">
                  <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
                    <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-75" />
                  </svg>
                  Saving
                </span>
              )}
              {saveStatus === "saved" && (
                <span className="text-emerald-500 inline-flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  Saved
                </span>
              )}
              {saveError && saveStatus === "error" && (
                <button
                  onClick={() => scheduleSave(values, fieldStates)}
                  className="text-amber-600 hover:text-amber-700 text-xs font-medium"
                  title="Click to retry saving"
                >
                  Unsaved — click to retry
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {/* Share explanations */}
            <button
              type="button"
              onClick={() => setShowShareModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 border border-slate-200 bg-white text-slate-600 text-sm rounded-lg font-medium hover:bg-slate-50 transition-colors"
              title="Share field explanations (no personal data)"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
              </svg>
              Share
            </button>
            {/* Jump to next empty field */}
            {unansweredCount > 0 && (
              <button
                type="button"
                onClick={() => navigateToUnansweredField(currentUnansweredIndex)}
                className="inline-flex items-center gap-1.5 px-4 py-2 border border-blue-200 bg-blue-50 text-blue-700 text-sm rounded-lg font-medium hover:bg-blue-100 transition-colors active:scale-[0.98]"
                aria-label={`Jump to next empty field. ${unansweredCount} empty field${unansweredCount === 1 ? "" : "s"} remaining.`}
                title="Jump to next empty field (press N or ] when not typing)"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 8 16 12 12 16" />
                  <line x1="8" y1="12" x2="16" y2="12" />
                </svg>
                {unansweredCount} empty field{unansweredCount === 1 ? "" : "s"}
              </button>
            )}
            {/* Required-empty pill — visible only when some required fields have no value */}
            {emptyRequiredCount > 0 && (
              <button
                type="button"
                onClick={navigateToFirstEmptyRequired}
                className="inline-flex items-center gap-1.5 px-4 py-2 border border-red-200 bg-red-50 text-red-700 text-sm rounded-lg font-medium hover:bg-red-100 transition-colors active:scale-[0.98]"
                aria-label={`${emptyRequiredCount} required field${emptyRequiredCount === 1 ? "" : "s"} still empty. Click to jump to the first one.`}
                title="Jump to first empty required field"
              >
                <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
                </svg>
                {emptyRequiredCount} required empty
              </button>
            )}
            {/* Sample fill button */}
            <button
              onClick={handleSampleFill}
              disabled={sampleFilling}
              className="inline-flex items-center gap-1.5 px-4 py-2 border border-slate-200 text-slate-700 text-sm rounded-lg font-medium hover:bg-slate-50 transition-colors disabled:opacity-40 active:scale-[0.98]"
              title="Fill all fields with sample/demo data"
            >
              {sampleFilling ? (
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
                  <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-75" />
                </svg>
              ) : (
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6L12 2z" />
                </svg>
              )}
              {sampleFilling ? "Filling..." : "Fill Sample Data"}
            </button>
            {highConfidencePendingCount > 0 && (
              <button
                onClick={handleAcceptAllHigh}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white text-sm rounded-lg font-medium hover:bg-emerald-700 transition-colors active:scale-[0.98]"
              >
                <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                Accept All High ({highConfidencePendingCount})
              </button>
            )}
            {filledCount > 0 && (
              <button
                onClick={handleValidate}
                className="inline-flex items-center gap-1.5 px-4 py-2 border border-slate-200 text-slate-700 text-sm rounded-lg font-medium hover:bg-slate-50 transition-colors active:scale-[0.98]"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M9 11l3 3L22 4" />
                  <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
                </svg>
                Validate
              </button>
            )}
            {filledCount > 0 && (
              <button
                onClick={openMappingEditor}
                disabled={mappingLoading}
                className="inline-flex items-center gap-1.5 px-4 py-2 border border-slate-200 text-slate-600 bg-white text-sm rounded-lg font-medium hover:bg-slate-50 transition-colors active:scale-[0.98] disabled:opacity-40"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
                  <rect x="9" y="3" width="6" height="4" rx="1" />
                  <path d="M9 12h6M9 16h4" />
                </svg>
                {mappingLoading ? "Loading…" : "Review Mapping"}
              </button>
            )}
            {filledCount > 0 && uncertainFieldCount > 0 && (
              <button
                onClick={() => setShowConfidenceReview(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 border border-amber-300 text-amber-700 bg-amber-50 text-sm rounded-lg font-medium hover:bg-amber-100 transition-colors active:scale-[0.98]"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                Review {uncertainFieldCount} uncertain field{uncertainFieldCount !== 1 ? "s" : ""}
              </button>
            )}
            {filledCount > 0 && (
              <button
                onClick={handleExport}
                disabled={exporting}
                className="inline-flex items-center gap-1.5 px-4 py-2 border border-slate-200 text-slate-700 text-sm rounded-lg font-medium hover:bg-slate-50 transition-colors disabled:opacity-40"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                {exporting ? "Exporting..." : "Export"}
              </button>
            )}
            {form.status === "COMPLETED" && (
              <CertificateButton formId={form.id} isPro={isPro} />
            )}
            {filledCount > 0 && onComplete && (
              <button
                onClick={handleMarkComplete}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white text-sm rounded-lg font-medium hover:bg-emerald-700 transition-colors active:scale-[0.98]"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Mark as Complete
              </button>
            )}
            {hasProfile && (
              <button
                onClick={handleAutofill}
                disabled={autofilling}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-40 active:scale-[0.98]"
              >
                {autofilling ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
                      <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-75" />
                    </svg>
                    Filling...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                    </svg>
                    Autofill from Profile
                  </>
                )}
              </button>
            )}
            {filledCount > 0 && (
              <button
                onClick={handleClearAll}
                className="inline-flex items-center gap-1.5 px-4 py-2 border border-slate-200 text-slate-500 text-sm rounded-lg font-medium hover:border-red-200 hover:text-red-600 hover:bg-red-50 transition-colors active:scale-[0.98]"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                  <path d="M10 11v6M14 11v6" />
                  <path d="M9 6V4h6v2" />
                </svg>
                Clear All
              </button>
            )}
          </div>
        </div>

        {/* Progress bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>{filledCount}/{fields.length} fields filled</span>
            <span className="font-medium tabular-nums">{progress}% complete</span>
          </div>
          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${progress}%`,
                background: progress === 100
                  ? "#10b981"
                  : "#3b82f6",
              }}
            />
          </div>
        </div>
      </div>

      {/* Sample fill success/error message */}
      {sampleFillMessage && (
        <div className={`flex items-center gap-2 px-4 py-3 rounded-xl border text-sm font-medium animate-slide-down ${
          sampleFillMessage.startsWith("Failed")
            ? "bg-red-50 border-red-200 text-red-700"
            : "bg-emerald-50 border-emerald-200 text-emerald-700"
        }`}>
          {sampleFillMessage.startsWith("Failed") ? (
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
            </svg>
          ) : (
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
            </svg>
          )}
          {sampleFillMessage}
        </div>
      )}

      {/* Validation Results Panel */}
      {validation && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-soft p-5 sm:p-6 space-y-4 animate-slide-down">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">Validation Results</h3>
            <button
              onClick={() => { setValidation(null); setShowForceExportDialog(false); }}
              className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
            >
              Dismiss
            </button>
          </div>

          {/* Completeness bar */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">Completeness</span>
              <span className="font-medium tabular-nums text-slate-700">{validation.completeness}%</span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${validation.completeness}%`,
                  background: validation.completeness === 100 ? "#10b981" : validation.completeness >= 75 ? "#f59e0b" : "#ef4444",
                }}
              />
            </div>
          </div>

          {/* Errors */}
          {validation.errors.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-red-700">
                <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
                </svg>
                {validation.errors.length} error{validation.errors.length !== 1 ? "s" : ""} (must fix before export)
              </div>
              <div className="space-y-1.5">
                {validation.errors.map((err, i) => (
                  <div key={`err-${i}`} className="flex items-start gap-2 p-3 bg-red-50 rounded-xl border border-red-100">
                    <span className="text-red-500 shrink-0 mt-0.5">
                      <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" /></svg>
                    </span>
                    <p className="text-xs text-red-700">{err.message}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Warnings */}
          {validation.warnings.filter((w) => w.rule === "low_confidence").length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-amber-700">
                <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                </svg>
                {validation.warnings.filter((w) => w.rule === "low_confidence").length} warning{validation.warnings.filter((w) => w.rule === "low_confidence").length !== 1 ? "s" : ""}
              </div>
              <div className="space-y-1.5">
                {validation.warnings.filter((w) => w.rule === "low_confidence").map((warn, i) => (
                  <div key={`warn-${i}`} className="flex items-start gap-2 p-3 bg-amber-50 rounded-xl border border-amber-100">
                    <span className="text-amber-500 shrink-0 mt-0.5">
                      <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" /></svg>
                    </span>
                    <p className="text-xs text-amber-700">{warn.message}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* All clear */}
          {validation.valid && validation.errors.length === 0 && (
            <div className="flex items-center gap-2 p-3 bg-emerald-50 rounded-xl border border-emerald-100">
              <svg className="w-4 h-4 text-emerald-600" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
              </svg>
              <p className="text-sm font-medium text-emerald-700">All checks passed — ready to export</p>
            </div>
          )}
        </div>
      )}

      {/* Force Export Dialog */}
      {showForceExportDialog && validation && !validation.valid && (
        <div className="bg-white rounded-2xl border-2 border-red-200 shadow-soft p-5 sm:p-6 space-y-4">
          <div className="flex items-center gap-2 text-red-700">
            <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
            </svg>
            <h3 className="text-sm font-bold">
              {validation.errors.length} error{validation.errors.length !== 1 ? "s" : ""} found. Export anyway?
            </h3>
          </div>
          <p className="text-xs text-slate-500">
            Your form has validation errors that could cause rejection. You can fix them or export anyway.
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => { setShowForceExportDialog(false); }}
              className="px-4 py-2 text-sm font-medium bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
            >
              Fix Errors
            </button>
            <button
              onClick={() => doExport(true)}
              disabled={exporting}
              className="px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-40"
            >
              {exporting ? "Exporting..." : "Export Anyway"}
            </button>
          </div>
        </div>
      )}

      {/* Confidence Legend */}
      <div className="flex flex-wrap gap-4 text-xs text-slate-500 px-1">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500" aria-hidden="true" />
          High (&gt;80%)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-500" aria-hidden="true" />
          Medium (50-80%)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-500" aria-hidden="true" />
          Low (&lt;50%)
        </span>
      </div>

      {/* Autofill error banner */}
      {autofillError && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3" role="alert">
          <svg className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-amber-800">{autofillError}</p>
            {hasProfile && (
              <button
                type="button"
                onClick={handleAutofill}
                disabled={autofilling}
                className="mt-1.5 text-sm font-medium text-amber-800 underline underline-offset-2 hover:text-amber-900 disabled:opacity-50"
              >
                Try again
              </button>
            )}
          </div>
          <button
            onClick={() => setAutofillError(null)}
            className="text-amber-400 hover:text-amber-600 shrink-0"
            aria-label="Dismiss error"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      )}

      {/* Autofill conflict toast — shown when another tab wrote to this form */}
      {autofillConflict && (
        <div className="flex items-start gap-3 bg-orange-50 border border-orange-200 rounded-xl px-4 py-3" role="alert">
          <svg className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-orange-800">Your form was updated in another tab. Reload to see the latest values.</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-1.5 text-sm font-medium text-orange-800 underline underline-offset-2 hover:text-orange-900"
            >
              Reload
            </button>
          </div>
          <button
            onClick={() => setAutofillConflict(false)}
            className="text-orange-300 hover:text-orange-500 shrink-0"
            aria-label="Dismiss"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      )}

      {/* Prior form offer — shown on fresh forms when a completed same-category form exists */}
      {priorFormOffer && (
        <div className="flex items-center gap-3 bg-violet-50 border border-violet-100 rounded-xl px-4 py-3" role="status">
          <svg className="w-4 h-4 text-violet-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <polyline points="9 15 12 12 15 15" />
            <line x1="12" y1="12" x2="12" y2="18" />
          </svg>
          <p className="flex-1 text-sm text-violet-700 min-w-0">
            Re-use answers from <span className="font-medium">{priorFormOffer.title}</span>?
          </p>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleApplyPriorFill}
              disabled={applyingPriorFill}
              className="px-3 py-1 text-xs font-semibold bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors disabled:opacity-50"
            >
              {applyingPriorFill ? "Applying…" : "Apply"}
            </button>
            <button
              onClick={handleDismissPriorFill}
              className="text-violet-300 hover:text-violet-500 transition-colors"
              aria-label="Dismiss"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Profile gap report — shown after autofill if some fields had no profile match */}
      {gapReportVisible && (
        <GapReportPanel
          gaps={profileGaps}
          formId={form.id}
          onDismiss={() => setGapReportVisible(false)}
        />
      )}

      {/* Prior fill banner — shown when form was pre-filled from a previous submission */}
      {fields.some((f) => f.matchedFrom === "prior_fill") && (
        <div className="flex items-center gap-2.5 px-4 py-2.5 bg-violet-50 border border-violet-100 rounded-xl text-sm text-violet-700">
          <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <polyline points="9 15 12 12 15 15" />
            <line x1="12" y1="12" x2="12" y2="18" />
          </svg>
          Pre-filled from a previous form — {fields.filter((f) => f.matchedFrom === "prior_fill").length} fields matched. Review and update any that may have changed.
        </div>
      )}

      {/* Resume session banner — shown when returning to an in-progress form */}
      {form.status === "FILLING" && filledCount > 0 && !fields.some((f) => f.matchedFrom === "prior_fill") && (
        <div className="flex items-center gap-2.5 px-4 py-2.5 bg-blue-50 border border-blue-100 rounded-xl text-sm text-blue-700">
          <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          Resuming your session — {filledCount} of {fields.length} fields filled.
        </div>
      )}

      {/* Required-empty export pre-flight banner */}
      {showRequiredEmptyBanner && emptyRequiredCount > 0 && (
        <div className="flex items-center justify-between gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl">
          <div className="flex items-center gap-2.5 min-w-0">
            <svg className="w-4 h-4 text-amber-500 shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
            </svg>
            <p className="text-sm text-amber-800 truncate">
              <span className="font-semibold">{emptyRequiredCount} required field{emptyRequiredCount === 1 ? "" : "s"} {emptyRequiredCount === 1 ? "is" : "are"} empty</span>
              {" "}— the form may be rejected if submitted as-is.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => { setShowRequiredEmptyBanner(false); navigateToFirstEmptyRequired(); }}
              className="text-xs font-semibold text-amber-700 hover:text-amber-900 underline underline-offset-2 whitespace-nowrap"
            >
              Review required fields
            </button>
            <button
              type="button"
              onClick={() => setShowRequiredEmptyBanner(false)}
              className="p-1 text-amber-400 hover:text-amber-700 transition-colors"
              aria-label="Dismiss"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Autofill confidence summary banner */}
      {autofillSummary && (
        <div className="flex items-start gap-3 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
          <svg className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-blue-900">Autofill complete</p>
            <p className="text-xs text-blue-700 mt-0.5">
              {autofillSummary.high > 0 && (
                <span className="text-emerald-700 font-medium">{autofillSummary.high} high</span>
              )}
              {autofillSummary.high > 0 && (autofillSummary.medium > 0 || autofillSummary.low > 0) && <span>, </span>}
              {autofillSummary.medium > 0 && (
                <span className="text-amber-700 font-medium">{autofillSummary.medium} medium</span>
              )}
              {autofillSummary.medium > 0 && autofillSummary.low > 0 && <span>, </span>}
              {autofillSummary.low > 0 && (
                <span className="text-red-600 font-medium">{autofillSummary.low} low</span>
              )}
              {" "}confidence
              {autofillSummary.unfilled > 0 && ` · ${autofillSummary.unfilled} field${autofillSummary.unfilled !== 1 ? "s" : ""} left blank`}
            </p>
            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
              <button
                type="button"
                onClick={openMappingEditor}
                disabled={mappingLoading}
                className="text-xs font-semibold text-blue-700 underline underline-offset-2 hover:text-blue-900 transition-colors disabled:opacity-50"
              >
                {mappingLoading ? "Loading…" : "Review Mapping"}
              </button>
              {autofillSummary.low > 0 && (() => {
                const firstLowField = fields.find((f) => f.confidence !== undefined && f.confidence < 0.5 && values[f.id]);
                return firstLowField ? (
                  <button
                    type="button"
                    className="text-xs text-blue-600 underline underline-offset-2 hover:text-blue-800 transition-colors"
                    onClick={() => {
                      const el = document.getElementById(`field-${firstLowField.id}`);
                      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
                    }}
                  >
                    Review low-confidence fields
                  </button>
                ) : null;
              })()}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setAutofillSummary(null)}
            className="p-1 text-blue-400 hover:text-blue-700 transition-colors shrink-0"
            aria-label="Dismiss"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      )}

      {/* Skipped fields banner — amber, shown when autofill left required fields empty */}
      {skippedFields.length > 0 && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3" role="alert">
          <svg className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
          </svg>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-amber-900">
              {skippedFields.length === 1
                ? "1 required field could not be filled automatically"
                : `${skippedFields.length} required fields could not be filled automatically`}
            </p>
            <button
              type="button"
              className="text-xs text-amber-700 underline underline-offset-2 mt-1 hover:text-amber-900 transition-colors"
              onClick={() => {
                const firstSkipped = skippedFields.find((sf) => !values[sf.id]);
                if (!firstSkipped) return;
                const el = document.getElementById(`field-${firstSkipped.id}`);
                if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
              }}
            >
              Show unfilled fields
            </button>
          </div>
          <button
            type="button"
            onClick={() => setSkippedFields([])}
            className="p-1 text-amber-400 hover:text-amber-700 transition-colors shrink-0"
            aria-label="Dismiss"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      )}

      {/* Field Cards */}
      <div className="space-y-3">
        {fields.map((field) => {
          const state: FieldState = fieldStates[field.id] ?? "pending";
          const hasAutofill = field.confidence !== undefined && field.confidence > 0 && Boolean(values[field.id]);
          const tier = field.confidence !== undefined && field.confidence > 0 ? confidenceTier(field.confidence) : null;
          const config = tier ? tierConfig[tier] : null;
          const isExplanationExpanded = expandedExplanations.has(field.id);

          const hasError = errorFieldIds.has(field.id) || Boolean(blurErrors[field.id]);
          const hasWarning = warningFieldIds.has(field.id);
          const skippedInfo = skippedFields.find((sf) => sf.id === field.id);

          // Card border color
          let cardClasses = "bg-white border-slate-200";
          if (hasError) {
            cardClasses = "bg-red-50/30 border-red-300";
          } else if (state === "accepted") {
            cardClasses = "bg-emerald-50/30 border-emerald-200";
          } else if (state === "rejected") {
            cardClasses = "bg-white border-slate-200 opacity-70";
          } else if (skippedInfo && !values[field.id]) {
            // Amber ring for skipped (unfilled) fields — not an error, just incomplete
            cardClasses = "bg-amber-50/10 border-amber-300 ring-2 ring-amber-300/50";
          } else if (hasWarning) {
            cardClasses = "bg-amber-50/20 border-amber-200";
          } else if (tier && hasAutofill) {
            cardClasses = `bg-white ${config!.border}`;
          } else if (activeField === field.id) {
            cardClasses = "bg-white border-blue-300 shadow-card";
          }

          // Input styling — text-base ensures 16px font on mobile (prevents iOS Safari zoom-on-focus)
          // min-h-[48px] ensures adequate touch target size on mobile
          let inputClasses = "mt-2 px-3.5 py-2.5 border rounded-xl text-base md:text-sm min-h-[48px] focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all ";
          if (hasError) {
            inputClasses += "border-red-300 bg-red-50/50 focus:ring-red-400";
          } else if (state === "accepted") {
            inputClasses += "border-emerald-200 bg-emerald-50/60 text-slate-700 cursor-not-allowed";
          } else if (state === "rejected") {
            inputClasses += "border-slate-200 bg-white";
          } else if (tier && hasAutofill) {
            inputClasses += `border-slate-200 ${config!.inputBg}`;
          } else {
            inputClasses += "border-slate-200 bg-white";
          }

          // Get inline error/warning messages for this field
          const fieldErrors = validation?.errors.filter((e) => e.fieldId === field.id) ?? [];
          const fieldWarnings = validation?.warnings.filter((w) => w.fieldId === field.id && w.rule === "low_confidence") ?? [];

          const isHighlighted = highlightedFieldId === field.id;

          return (
            <div
              key={field.id}
              className={`rounded-2xl border transition-all shadow-soft ${cardClasses}${isHighlighted ? " field-highlight" : ""}`}
              onAnimationEnd={() => {
                if (isHighlighted) setHighlightedFieldId(null);
              }}
            >
              <div className="p-5 space-y-3">
                {/* Top row: label + actions */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <label
                        htmlFor={`field-${field.id}`}
                        className="text-sm font-semibold text-slate-900"
                      >
                        {field.label}
                        {field.required && (
                          <span className="text-red-500 ml-0.5" aria-label="required">*</span>
                        )}
                      </label>
                      {/* Help icon */}
                      <button
                        type="button"
                        onClick={(e) => openHelp(field.id, e.currentTarget)}
                        className="inline-flex items-center justify-center w-5 h-5 rounded-full text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors shrink-0"
                        aria-label={`Help for ${field.label}`}
                        title="What should I enter here?"
                      >
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <circle cx="12" cy="12" r="10" />
                          <path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" />
                          <line x1="12" y1="17" x2="12.01" y2="17" />
                        </svg>
                      </button>

                      {/* State badges */}
                      {state === "accepted" && (
                        <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                          <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                          Accepted
                        </span>
                      )}
                      {state === "rejected" && (
                        <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                          Skipped
                        </span>
                      )}
                      {field.matchedFrom === "prior_fill" && state !== "accepted" && state !== "rejected" && (
                        <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">
                          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                            <polyline points="14 2 14 8 20 8" />
                            <polyline points="9 15 12 12 15 15" />
                          </svg>
                          Prior fill
                        </span>
                      )}
                      {field.matchedFrom === "prior_fill" && /date|expir|year|current|today|period/i.test(field.label) && state !== "accepted" && state !== "rejected" && (
                        <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                          <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                            <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                          </svg>
                          Verify this
                        </span>
                      )}
                      {/* Skip reason badge — shown for autofill-skipped fields that are still empty */}
                      {skippedInfo && !values[field.id] && (() => {
                        const SKIP_REASON_LABELS: Record<string, string> = {
                          low_confidence: "Not enough info in your profile",
                          missing_profile_data: "Missing from your profile",
                          type_mismatch: "This field needs a specific format",
                          timeout: "Autofill timed out — try again",
                        };
                        return (
                          <span
                            className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700"
                            title={SKIP_REASON_LABELS[skippedInfo.reason] ?? "Could not autofill"}
                          >
                            <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                              <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                            </svg>
                            Fill manually
                          </span>
                        );
                      })()}
                      {/* Notepad icon — shown when a note exists for this field */}
                      {fieldNotes?.[field.id] && (
                        <span
                          className="inline-flex items-center justify-center w-4 h-4 text-amber-500 shrink-0"
                          aria-label="This field has a note"
                          title="This field has a note"
                        >
                          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                            <polyline points="14 2 14 8 20 8" />
                            <line x1="16" y1="13" x2="8" y2="13" />
                            <line x1="16" y1="17" x2="8" y2="17" />
                          </svg>
                        </span>
                      )}
                    </div>

                    {/* Input — checkbox or text */}
                    {field.type === "checkbox" ? (
                      <div className="mt-3 flex items-center gap-3 min-h-[48px]">
                        <button
                          id={`field-${field.id}`}
                          type="button"
                          role="checkbox"
                          aria-checked={values[field.id] === "Checked"}
                          disabled={state === "accepted"}
                          onClick={() => {
                            const next = values[field.id] === "Checked" ? "Unchecked" : "Checked";
                            handleValueChange(field.id, next);
                          }}
                          onFocus={() => {
                            setActiveField(field.id);
                            onFieldFocus?.(field.id);
                            setExpandedExplanations((prev) => new Set(prev).add(field.id));
                          }}
                          onBlur={() => {
                            setActiveField(null);
                            onFieldFocus?.(null);
                          }}
                          className={`relative w-12 h-6 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-400 ${
                            values[field.id] === "Checked"
                              ? "bg-blue-500"
                              : "bg-slate-200"
                          } ${state === "accepted" ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
                        >
                          <span
                            className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${
                              values[field.id] === "Checked" ? "translate-x-6" : "translate-x-0"
                            }`}
                          />
                        </button>
                        <span className="text-sm text-slate-600">
                          {values[field.id] === "Checked" ? "Checked" : "Unchecked"}
                        </span>
                      </div>
                    ) : (
                      <div className="relative flex items-center gap-1.5">
                        <input
                          id={`field-${field.id}`}
                          type={field.type === "date" ? "date" : "text"}
                          value={values[field.id] ?? ""}
                          onChange={(e) => handleValueChange(field.id, e.target.value)}
                          onFocus={() => {
                            setActiveField(field.id);
                            onFieldFocus?.(field.id);
                            setExpandedExplanations((prev) => new Set(prev).add(field.id));
                          }}
                          onBlur={() => {
                            setActiveField(null);
                            onFieldFocus?.(null);
                            handleFieldBlurForCorrection(field.id, field.label);
                            const currentVal = values[field.id] ?? "";
                            // Required-field check takes priority over format errors
                            if (field.required && !currentVal.trim()) {
                              setBlurErrors((prev) => ({ ...prev, [field.id]: "This field is required" }));
                            } else {
                              // Per-field format validation on blur
                              const formatErr = validateFieldFormat(field, currentVal);
                              if (formatErr) {
                                setBlurErrors((prev) => ({ ...prev, [field.id]: formatErr }));
                              } else {
                                setBlurErrors((prev) => { const next = { ...prev }; delete next[field.id]; return next; });
                              }
                            }
                          }}
                          disabled={state === "accepted"}
                          aria-disabled={state === "accepted"}
                          className={`${inputClasses} flex-1`}
                          placeholder={state === "rejected" ? "Enter value manually..." : field.example}
                        />
                        {/* Per-field random fill button — pure client-side, no API call */}
                        {state !== "accepted" && (
                          <button
                            type="button"
                            aria-label={`Fill ${field.label} with sample data`}
                            title="Fill with sample data"
                            onClick={() => handleValueChange(field.id, generateSampleValue(field))}
                            className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-blue-500 hover:bg-blue-50 transition-colors border border-slate-200 mt-2"
                          >
                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <path d="M15 4V2" /><path d="M15 16v-2" /><path d="M8 9h2" /><path d="M20 9h2" />
                              <path d="M17.8 11.8 19 13" /><path d="M15 9h.01" /><path d="M17.8 6.2 19 5" />
                              <path d="m3 21 9-9" /><path d="M12.2 6.2 11 5" />
                            </svg>
                          </button>
                        )}
                      </div>
                    )}
                    {/* Inline validation messages — blur errors shown in real-time; fieldErrors after export */}
                    {blurErrors[field.id] && !fieldErrors.some((e) => e.message === blurErrors[field.id]) && (
                      <p className="mt-1.5 text-xs text-red-600 flex items-center gap-1">
                        <svg className="w-3 h-3 shrink-0" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" /></svg>
                        {blurErrors[field.id]}
                      </p>
                    )}
                    {fieldErrors.map((err, i) => (
                      <p key={`fe-${i}`} className="mt-1.5 text-xs text-red-600 flex items-center gap-1">
                        <svg className="w-3 h-3 shrink-0" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" /></svg>
                        {err.message}
                      </p>
                    ))}
                    {fieldWarnings.map((warn, i) => (
                      <p key={`fw-${i}`} className="mt-1.5 text-xs text-amber-600 flex items-center gap-1">
                        <svg className="w-3 h-3 shrink-0" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" /></svg>
                        {warn.message}
                      </p>
                    ))}
                    {/* Correction toast — shown when user edits an AI-autofilled field */}
                    {correctionToasts[field.id] === "pending" && (
                      <div className="mt-2 flex items-center gap-2 px-3 py-2 bg-violet-50 border border-violet-200 rounded-lg text-xs animate-slide-down">
                        <svg className="w-3.5 h-3.5 text-violet-600 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19H4v-3L16.5 3.5z"/></svg>
                        <span className="text-violet-800 flex-1">Save as preference?</span>
                        <button
                          type="button"
                          onClick={() => saveCorrection(field.id)}
                          className="text-violet-700 font-semibold hover:text-violet-900 transition-colors"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => dismissCorrectionToast(field.id)}
                          className="text-violet-400 hover:text-violet-600 transition-colors"
                          aria-label="Dismiss"
                        >
                          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        </button>
                      </div>
                    )}
                    {correctionToasts[field.id] === "saving" && (
                      <div className="mt-2 flex items-center gap-2 px-3 py-2 bg-violet-50 border border-violet-200 rounded-lg text-xs">
                        <svg className="w-3.5 h-3.5 animate-spin text-violet-600" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25"/><path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-75"/></svg>
                        <span className="text-violet-700">Saving...</span>
                      </div>
                    )}
                    {correctionToasts[field.id] === "saved" && (
                      <div className="mt-2 flex items-center gap-2 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-lg text-xs animate-slide-down">
                        <svg className="w-3.5 h-3.5 text-emerald-600" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd"/></svg>
                        <span className="text-emerald-700 font-medium">Saved as preference</span>
                      </div>
                    )}
                  </div>

                  {/* Right column: confidence + actions */}
                  <div className="flex flex-col items-end gap-2 shrink-0 mt-0.5">
                    {/* Confidence indicator */}
                    {tier !== null && config && field.confidence !== undefined && field.confidence > 0 && (
                      <div className={`flex items-center gap-2 text-xs px-2.5 py-1 rounded-lg border font-medium ${config.badge}`}>
                        {/* Mini bar */}
                        <div className="w-10 h-1.5 bg-slate-200 rounded-full overflow-hidden" aria-hidden="true">
                          <div
                            className={`h-full rounded-full ${config.bar}`}
                            style={{ width: `${Math.round(field.confidence * 100)}%` }}
                          />
                        </div>
                        <span className="tabular-nums">{Math.round(field.confidence * 100)}%</span>
                      </div>
                    )}

                    {/* Improve suggestion button — for low/medium confidence pending fields */}
                    {hasAutofill && state === "pending" && tier !== "high" && (
                      <button
                        onClick={() => fetchFieldSuggestion(field.id)}
                        disabled={suggestingFields.has(field.id)}
                        className="inline-flex items-center gap-1 text-xs text-violet-600 hover:text-violet-800 disabled:opacity-50 transition-colors"
                        aria-label={`Get a better suggestion for ${field.label}`}
                      >
                        {suggestingFields.has(field.id) ? (
                          <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25"/><path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-75"/></svg>
                        ) : (
                          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19H4v-3L16.5 3.5z"/></svg>
                        )}
                        {suggestingFields.has(field.id) ? "Asking..." : "Improve"}
                      </button>
                    )}

                    {/* Accept / Reject buttons */}
                    {hasAutofill && state === "pending" && (
                      <div className="flex gap-1.5" role="group" aria-label={`Review suggestion for ${field.label}`}>
                        <button
                          onClick={() => handleAccept(field.id)}
                          aria-label={`Accept autofill for ${field.label}`}
                          title="Accept suggestion"
                          className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 hover:bg-emerald-200 transition-colors active:scale-95"
                        >
                          <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleReject(field.id)}
                          aria-label={`Reject autofill for ${field.label}`}
                          title="Reject and clear"
                          className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 transition-colors active:scale-95"
                        >
                          <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                        </button>
                      </div>
                    )}

                    {state === "rejected" && (
                      <div className="flex flex-col items-end gap-1">
                        <button
                          onClick={() => handleUndoReject(field.id)}
                          className="text-xs text-blue-500 hover:text-blue-700 transition-colors"
                        >
                          Undo
                        </button>
                        <button
                          onClick={() => fetchFieldSuggestion(field.id)}
                          disabled={suggestingFields.has(field.id)}
                          className="inline-flex items-center gap-1 text-xs text-violet-600 hover:text-violet-800 disabled:opacity-50 transition-colors"
                          aria-label={`Get AI suggestion for ${field.label}`}
                        >
                          {suggestingFields.has(field.id) ? (
                            <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25"/><path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-75"/></svg>
                          ) : (
                            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                          )}
                          {suggestingFields.has(field.id) ? "Asking..." : "Get suggestion"}
                        </button>
                      </div>
                    )}

                    {state === "accepted" && (
                      <button
                        onClick={() => handleUnlock(field.id)}
                        className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
                      >
                        Edit
                      </button>
                    )}
                  </div>
                </div>

                {/* Suggestion callout */}
                {field.id in fieldSuggestions && (() => {
                  const sugg = fieldSuggestions[field.id];
                  const isError = sugg !== null && sugg !== undefined && "error" in sugg;
                  const isFound = sugg !== null && sugg !== undefined && !isError;
                  return (
                    <div className={`rounded-xl border px-4 py-3 flex items-start justify-between gap-3 ${
                      isFound ? "bg-violet-50 border-violet-200" : "bg-slate-50 border-slate-200"
                    }`}>
                      {isError ? (
                        <>
                          <p className="text-xs text-slate-400 italic">Suggestion unavailable</p>
                          <button onClick={() => dismissSuggestion(field.id)} aria-label={`Dismiss suggestion for ${field.label}`} className="text-xs text-slate-400 hover:text-slate-600"><span aria-hidden="true">✕</span></button>
                        </>
                      ) : isFound ? (
                        <>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 mb-1">
                              {(sugg as { value: string; source: string; sourceType?: string }).sourceType === "memory" ? (
                                <span className="text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full">
                                  From memory
                                </span>
                              ) : (
                                <span className="text-xs font-medium text-violet-700">Suggested value</span>
                              )}
                            </div>
                            <p className="text-sm text-slate-800 font-medium truncate">{(sugg as { value: string; source: string }).value}</p>
                            <p className="text-xs text-slate-400 mt-0.5">From: {(sugg as { value: string; source: string }).source}</p>
                          </div>
                          <div className="flex gap-1.5 shrink-0">
                            <button
                              onClick={() => handleAcceptSuggestion(field.id)}
                              className="px-2.5 py-1 text-xs font-medium bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors active:scale-95"
                            >
                              Use it
                            </button>
                            <button
                              onClick={() => dismissSuggestion(field.id)}
                              className="px-2.5 py-1 text-xs font-medium text-slate-500 hover:text-slate-700 transition-colors"
                            >
                              Dismiss
                            </button>
                          </div>
                        </>
                      ) : (
                        <>
                          <p className="text-xs text-slate-500">No suggestion found from your history.</p>
                          <button onClick={() => dismissSuggestion(field.id)} aria-label={`Dismiss suggestion for ${field.label}`} className="text-xs text-slate-400 hover:text-slate-600"><span aria-hidden="true">✕</span></button>
                        </>
                      )}
                    </div>
                  );
                })()}

                {/* Explanation - collapsible */}
                <div className="border-t border-slate-100 pt-3">
                  <button
                    type="button"
                    onClick={() => toggleExplanation(field.id)}
                    className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors"
                  >
                    <svg
                      className={`w-3.5 h-3.5 transition-transform duration-200 ${isExplanationExpanded ? "rotate-90" : ""}`}
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                    </svg>
                    {isExplanationExpanded ? "Hide explanation" : "What should I enter?"}
                  </button>

                  {isExplanationExpanded && (
                    <div className="mt-2.5 bg-blue-50/70 rounded-xl p-4 space-y-2 animate-slide-down">
                      <p className="text-sm text-slate-700 leading-relaxed">{field.explanation}</p>
                      {field.example && (
                        <p className="text-xs text-slate-500">
                          <span className="font-medium text-slate-600">Example:</span>{" "}
                          <span className="font-mono bg-white/60 px-1.5 py-0.5 rounded">{field.example}</span>
                        </p>
                      )}
                      {field.commonMistakes && (
                        <div className="flex items-start gap-2 mt-1 pt-2 border-t border-blue-100">
                          <svg className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                            <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                          </svg>
                          <p className="text-xs text-amber-700">
                            <span className="font-medium">Common mistake:</span> {field.commonMistakes}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Where to find this */}
                {field.whereToFind && (
                  <div className="bg-slate-50 rounded-lg p-3 flex items-start gap-2">
                    <svg className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <circle cx="11" cy="11" r="8" />
                      <path d="m21 21-4.3-4.3" />
                    </svg>
                    <div>
                      <p className="text-xs font-semibold text-slate-600">Where to find this</p>
                      <p className="text-sm text-slate-700">{field.whereToFind}</p>
                    </div>
                  </div>
                )}

                {/* Field note */}
                <FieldNote
                  formId={form.id}
                  fieldId={field.id}
                  initialNote={fieldNotes?.[field.id] ?? null}
                  onNoteChange={onNoteChange}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Floating "Next unanswered" button */}
      {unansweredCount > 0 && (
        <button
          onClick={() => navigateToUnansweredField(currentUnansweredIndex + 1)}
          title="Jump to next unanswered field (Alt+N)"
          className="fixed bottom-6 right-4 sm:right-6 z-20 flex items-center justify-center gap-2 px-4 py-3 min-h-[48px] bg-blue-600 text-white rounded-lg font-medium shadow-lg hover:bg-blue-700 transition-colors active:scale-95"
          aria-label={`${unansweredCount} unanswered remaining. Press Alt+N for next or Alt+P for previous.`}
        >
          <span className="hidden sm:inline">
            {unansweredCount} unanswered
          </span>
          <span className="sm:hidden">
            {unansweredCount}
          </span>
          <kbd className="hidden sm:inline text-xs bg-blue-700 px-2 py-1 rounded">Alt+N</kbd>
        </button>
      )}
    </div>
    {showShareModal && (
      <ShareModal formId={form.id} onClose={() => setShowShareModal(false)} />
    )}

    {/* Undo autofill toast */}
    {(showUndoToast || undoConfirmFlash) && (
      <div className="fixed bottom-6 right-4 sm:right-6 z-50 flex items-center gap-3 bg-slate-900 text-white text-sm font-medium rounded-xl shadow-lg px-4 py-3 animate-fade-in">
        {undoConfirmFlash ? (
          <span>Autofill undone</span>
        ) : (
          <>
            <span>Autofill applied</span>
            <button
              type="button"
              onClick={handleUndoAutofill}
              className="text-blue-300 hover:text-white underline underline-offset-2 transition-colors"
            >
              Undo
            </button>
            <button
              type="button"
              onClick={() => { setShowUndoToast(false); if (undoTimerRef.current) clearTimeout(undoTimerRef.current); preAutofillSnapshot.current = null; }}
              className="text-slate-400 hover:text-white transition-colors ml-1"
              aria-label="Dismiss"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </>
        )}
      </div>
    )}
    </>
  );
}
