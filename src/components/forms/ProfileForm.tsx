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
}

interface Props {
  initialData: Record<string, unknown> | null;
}

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
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set(key: keyof ProfileData, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
    setSaved(false);
  }

  function setAddress(key: keyof NonNullable<ProfileData["address"]>, value: string) {
    setForm((f) => ({ ...f, address: { ...f.address, [key]: value } }));
    setSaved(false);
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
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Personal</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="First Name" value={form.firstName ?? ""} onChange={(v) => set("firstName", v)} required />
          <Field label="Last Name" value={form.lastName ?? ""} onChange={(v) => set("lastName", v)} required />
        </div>
        <Field label="Email" type="email" value={form.email ?? ""} onChange={(v) => set("email", v)} required />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Phone" value={form.phone ?? ""} onChange={(v) => set("phone", v)} />
          <Field label="Date of Birth" type="date" value={form.dateOfBirth ?? ""} onChange={(v) => set("dateOfBirth", v)} />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Address</h2>
        <Field label="Street" value={form.address?.street ?? ""} onChange={(v) => setAddress("street", v)} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="City" value={form.address?.city ?? ""} onChange={(v) => setAddress("city", v)} />
          <Field label="State / Province" value={form.address?.state ?? ""} onChange={(v) => setAddress("state", v)} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="ZIP / Postal Code" value={form.address?.zip ?? ""} onChange={(v) => setAddress("zip", v)} />
          <Field label="Country" value={form.address?.country ?? ""} onChange={(v) => setAddress("country", v)} />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Employment</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Employer Name" value={form.employerName ?? ""} onChange={(v) => set("employerName", v)} />
          <Field label="Job Title" value={form.jobTitle ?? ""} onChange={(v) => set("jobTitle", v)} />
        </div>
        <Field label="Annual Income (USD)" value={form.annualIncome ?? ""} onChange={(v) => set("annualIncome", v)} />
      </section>

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

function Field({
  label,
  value,
  onChange,
  type = "text",
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium text-slate-700">
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
