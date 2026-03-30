"use client";

import { useState } from "react";

const SUPPORTED_LANGUAGES = [
  { code: "en", label: "English" },
  { code: "es", label: "Spanish" },
  { code: "zh", label: "Chinese Simplified" },
  { code: "ko", label: "Korean" },
  { code: "vi", label: "Vietnamese" },
  { code: "tl", label: "Tagalog" },
  { code: "ar", label: "Arabic" },
  { code: "hi", label: "Hindi" },
  { code: "fr", label: "French" },
  { code: "pt", label: "Portuguese" },
] as const;

type LanguageCode = typeof SUPPORTED_LANGUAGES[number]["code"];

interface ProfileData {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  dateOfBirth?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    zip?: string;
    country?: string;
  };
  employerName?: string;
  jobTitle?: string;
  annualIncome?: string;
  ssn?: string;
  passportNumber?: string;
  driverLicense?: string;
  taxId?: string;
}

interface Props {
  initialData: Record<string, unknown> | null;
  initialPreferredLanguage?: string | null;
}

export default function ProfileForm({ initialData, initialPreferredLanguage }: Props) {
  const data = (initialData ?? {}) as ProfileData;
  const [form, setForm] = useState<ProfileData>({
    firstName: data.firstName ?? "",
    lastName: data.lastName ?? "",
    email: data.email ?? "",
    phone: data.phone ?? "",
    dateOfBirth: data.dateOfBirth ?? "",
    address: {
      street: data.address?.street ?? "",
      city: data.address?.city ?? "",
      state: data.address?.state ?? "",
      zip: data.address?.zip ?? "",
      country: data.address?.country ?? "",
    },
    employerName: data.employerName ?? "",
    jobTitle: data.jobTitle ?? "",
    annualIncome: data.annualIncome ?? "",
    ssn: data.ssn ?? "",
    passportNumber: data.passportNumber ?? "",
    driverLicense: data.driverLicense ?? "",
    taxId: data.taxId ?? "",
  });
  const [preferredLanguage, setPreferredLanguage] = useState<LanguageCode>(
    (initialPreferredLanguage as LanguageCode | undefined) ?? "en"
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const CORE_FIELDS: { label: string; value: string | undefined; category: string }[] = [
    { label: "First name", value: form.firstName, category: "Personal, Tax, Immigration" },
    { label: "Last name", value: form.lastName, category: "Personal, Tax, Immigration" },
    { label: "Email", value: form.email, category: "All forms" },
    { label: "Phone", value: form.phone, category: "Personal, HR, Healthcare" },
    { label: "Date of birth", value: form.dateOfBirth, category: "Immigration, Healthcare" },
    { label: "Street address", value: form.address?.street, category: "Tax, Immigration, HR" },
    { label: "City", value: form.address?.city, category: "Tax, Immigration, HR" },
    { label: "State", value: form.address?.state, category: "Tax, HR" },
    { label: "ZIP code", value: form.address?.zip, category: "Tax, Immigration" },
    { label: "Country", value: form.address?.country, category: "Immigration" },
  ];

  const filledCount = CORE_FIELDS.filter((f) => f.value?.trim()).length;
  const completeness = Math.round((filledCount / CORE_FIELDS.length) * 100);

  function set(key: keyof ProfileData, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
    setSaved(false);
  }

  function setAddress(key: keyof NonNullable<ProfileData["address"]>, value: string) {
    setForm((f) => ({ ...f, address: { ...f.address, [key]: value } }));
    setSaved(false);
  }

  function toggleSection(name: string) {
    setCollapsed((c) => ({ ...c, [name]: !c[name] }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, preferredLanguage }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Save failed");
      }
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Completeness bar */}
      <div className="bg-slate-50 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-slate-700">Profile completeness</span>
          <span className={`text-sm font-semibold tabular-nums ${completeness >= 80 ? "text-emerald-600" : completeness >= 50 ? "text-amber-600" : "text-slate-500"}`}>
            {completeness}%
          </span>
        </div>
        <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${completeness >= 80 ? "bg-emerald-500" : completeness >= 50 ? "bg-amber-500" : "bg-blue-500"}`}
            style={{ width: `${completeness}%` }}
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
          {CORE_FIELDS.map((field) => {
            const filled = !!field.value?.trim();
            return (
              <div key={field.label} className="flex items-center gap-2 text-xs">
                {filled ? (
                  <svg className="w-3.5 h-3.5 text-emerald-500 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <svg className="w-3.5 h-3.5 text-slate-300 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                    <circle cx="10" cy="10" r="9" stroke="currentColor" strokeWidth="2" fill="none" />
                  </svg>
                )}
                <span className={filled ? "text-slate-600" : "text-slate-400"}>{field.label}</span>
                {!filled && <span className="text-slate-300 truncate hidden sm:inline">· {field.category}</span>}
              </div>
            );
          })}
        </div>
      </div>

      {/* Personal */}
      <Section title="Personal" collapsed={collapsed["personal"]} onToggle={() => toggleSection("personal")}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="First Name" value={form.firstName ?? ""} onChange={(v) => set("firstName", v)} required />
          <Field label="Last Name" value={form.lastName ?? ""} onChange={(v) => set("lastName", v)} required />
        </div>
        <Field label="Email" type="email" value={form.email ?? ""} onChange={(v) => set("email", v)} required />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Phone" value={form.phone ?? ""} onChange={(v) => set("phone", v)} />
          <Field label="Date of Birth" type="date" value={form.dateOfBirth ?? ""} onChange={(v) => set("dateOfBirth", v)} />
        </div>
      </Section>

      {/* Address */}
      <Section title="Address" collapsed={collapsed["address"]} onToggle={() => toggleSection("address")}>
        <Field label="Street" value={form.address?.street ?? ""} onChange={(v) => setAddress("street", v)} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="City" value={form.address?.city ?? ""} onChange={(v) => setAddress("city", v)} />
          <Field label="State / Province" value={form.address?.state ?? ""} onChange={(v) => setAddress("state", v)} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="ZIP / Postal Code" value={form.address?.zip ?? ""} onChange={(v) => setAddress("zip", v)} />
          <Field label="Country" value={form.address?.country ?? ""} onChange={(v) => setAddress("country", v)} />
        </div>
      </Section>

      {/* Employment */}
      <Section title="Employment" collapsed={collapsed["employment"]} onToggle={() => toggleSection("employment")}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Employer Name" value={form.employerName ?? ""} onChange={(v) => set("employerName", v)} />
          <Field label="Job Title" value={form.jobTitle ?? ""} onChange={(v) => set("jobTitle", v)} />
        </div>
        <Field label="Annual Income (USD)" value={form.annualIncome ?? ""} onChange={(v) => set("annualIncome", v)} />
      </Section>

      {/* Preferences */}
      <Section title="Preferences" collapsed={collapsed["preferences"]} onToggle={() => toggleSection("preferences")}>
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-slate-700">Preferred Language</label>
          <p className="text-xs text-slate-500 mb-2">Field explanations and examples will be shown in this language.</p>
          <select
            value={preferredLanguage}
            onChange={(e) => {
              setPreferredLanguage(e.target.value as LanguageCode);
              setSaved(false);
            }}
            className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition-all bg-white"
          >
            {SUPPORTED_LANGUAGES.map((lang) => (
              <option key={lang.code} value={lang.code}>{lang.label}</option>
            ))}
          </select>
        </div>
      </Section>

      {/* Identity Documents */}
      <Section title="Identity Documents" collapsed={collapsed["identity"]} onToggle={() => toggleSection("identity")} sensitive>
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-1">
          <svg className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0110 0v4" />
          </svg>
          <p className="text-sm text-amber-700">
            <span className="font-medium">Encrypted at rest.</span> These fields are encrypted with AES-256-GCM before storage and never sent to AI services.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="SSN (last 4)" value={form.ssn ?? ""} onChange={(v) => set("ssn", v)} sensitive />
          <Field label="Passport Number" value={form.passportNumber ?? ""} onChange={(v) => set("passportNumber", v)} sensitive />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Driver's License" value={form.driverLicense ?? ""} onChange={(v) => set("driverLicense", v)} sensitive />
          <Field label="Tax ID" value={form.taxId ?? ""} onChange={(v) => set("taxId", v)} sensitive />
        </div>
      </Section>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3.5 animate-slide-down">
          <svg className="w-5 h-5 text-red-500 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Success */}
      {saved && !error && (
        <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3.5 animate-slide-down">
          <svg className="w-5 h-5 text-emerald-500 shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
          <p className="text-sm text-emerald-700 font-medium">Profile saved successfully.</p>
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={saving}
        className="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] shadow-sm"
      >
        {saving ? (
          <span className="inline-flex items-center gap-2">
            <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
              <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-75" />
            </svg>
            Saving...
          </span>
        ) : (
          "Save Profile"
        )}
      </button>
    </form>
  );
}

function Section({
  title,
  children,
  collapsed,
  onToggle,
  sensitive,
}: {
  title: string;
  children: React.ReactNode;
  collapsed?: boolean;
  onToggle: () => void;
  sensitive?: boolean;
}) {
  return (
    <section className="border border-slate-200 rounded-2xl overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-5 py-3.5 bg-slate-50 hover:bg-slate-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          {sensitive && (
            <svg className="w-4 h-4 text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0110 0v4" />
            </svg>
          )}
          <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">{title}</h2>
        </div>
        <svg
          className={`w-5 h-5 text-slate-400 transition-transform duration-200 ${collapsed ? "" : "rotate-180"}`}
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      </button>
      {!collapsed && <div className="px-5 py-4 space-y-4">{children}</div>}
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  required,
  sensitive,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  sensitive?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
        {sensitive && (
          <svg className="w-3.5 h-3.5 text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0110 0v4" />
          </svg>
        )}
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition-all bg-white"
      />
    </div>
  );
}
