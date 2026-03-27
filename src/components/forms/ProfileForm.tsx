"use client";

import { useState } from "react";

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
}

const SENSITIVE_FIELDS = new Set(["ssn", "passportNumber", "driverLicense", "taxId"]);

export default function ProfileForm({ initialData }: Props) {
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
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

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
        body: JSON.stringify(form),
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
    <form onSubmit={handleSubmit} className="space-y-6">
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

      {/* Identity Documents (Encrypted) */}
      <Section title="Identity Documents" collapsed={collapsed["identity"]} onToggle={() => toggleSection("identity")} sensitive>
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-700 mb-4">
          <span className="font-medium">Encrypted at rest.</span> These fields are encrypted with AES-256-GCM before storage. They are never sent to AI services.
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

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>
      )}

      <button
        type="submit"
        disabled={saving}
        className="w-full py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50"
      >
        {saving ? "Saving..." : saved ? "Saved!" : "Save Profile"}
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
    <section className="border border-slate-200 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-5 py-3 bg-slate-50 hover:bg-slate-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          {sensitive && (
            <svg className="w-4 h-4 text-amber-500" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
            </svg>
          )}
          <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">{title}</h2>
        </div>
        <svg
          className={`w-5 h-5 text-slate-400 transition-transform ${collapsed ? "" : "rotate-180"}`}
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
    <div className="space-y-1">
      <label className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
        {sensitive && (
          <svg className="w-3.5 h-3.5 text-amber-500" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
          </svg>
        )}
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
      />
    </div>
  );
}
