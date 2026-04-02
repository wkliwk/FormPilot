"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";

const FIELD_LABELS: Record<string, string> = {
  firstName: "First name",
  lastName: "Last name",
  email: "Email",
  phone: "Phone",
  dateOfBirth: "Date of birth",
  employerName: "Employer",
  jobTitle: "Job title",
  annualIncome: "Annual income",
  address: "Address",
};

function flatten(obj: Record<string, unknown>, prefix = ""): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, val] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof val === "object" && val !== null) {
      Object.assign(result, flatten(val as Record<string, unknown>, fullKey));
    } else if (val !== null && val !== undefined) {
      result[fullKey] = String(val);
    }
  }
  return result;
}

function ProfileImportInner() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token") ?? "";

  const [state, setState] = useState<"loading" | "preview" | "error" | "importing" | "done">("loading");
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!token) {
      setErrorMsg("No import token found in the URL.");
      setState("error");
      return;
    }
    fetch(`/api/profile/import-preview?token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setErrorMsg(data.error);
          setState("error");
        } else {
          setProfile(data.profile);
          setState("preview");
        }
      })
      .catch(() => {
        setErrorMsg("Something went wrong loading the preview.");
        setState("error");
      });
  }, [token]);

  async function handleImport() {
    setState("importing");
    try {
      const res = await fetch("/api/profile/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (res.status === 401) {
        // Not logged in — redirect to login then back
        router.push(`/login?callbackUrl=${encodeURIComponent(window.location.href)}`);
        return;
      }
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error ?? "Import failed.");
        setState("error");
        return;
      }
      setState("done");
      setTimeout(() => router.push("/dashboard/profile?imported=1"), 1500);
    } catch {
      setErrorMsg("Something went wrong. Please try again.");
      setState("error");
    }
  }

  if (state === "loading") {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 text-slate-400">
        <svg className="w-8 h-8 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
          <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-75" />
        </svg>
        <p className="text-sm">Loading profile preview…</p>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 text-center px-4">
        <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center">
          <svg className="w-6 h-6 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Import failed</h2>
          <p className="text-sm text-slate-500 mt-1">{errorMsg}</p>
        </div>
        <Link href="/dashboard/profile" className="text-sm text-blue-600 underline hover:text-blue-800">
          Go to my profile
        </Link>
      </div>
    );
  }

  if (state === "done") {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 text-center px-4">
        <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center">
          <svg className="w-6 h-6 text-emerald-500" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        </div>
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Profile imported!</h2>
          <p className="text-sm text-slate-500 mt-1">Redirecting to your profile…</p>
        </div>
      </div>
    );
  }

  if (state === "importing") {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 text-slate-400">
        <svg className="w-8 h-8 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
          <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-75" />
        </svg>
        <p className="text-sm">Importing your profile…</p>
      </div>
    );
  }

  // state === "preview"
  const flat = profile ? flatten(profile) : {};
  const topKeys = Object.entries(profile ?? {}).filter(([, v]) => typeof v !== "object");
  const hasAddress = Boolean(profile?.address && typeof profile.address === "object");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Import Profile</h1>
        <p className="text-slate-500 mt-1 text-sm">
          The following details will be added to your Profile Vault. Existing fields won&apos;t be overwritten.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-soft divide-y divide-slate-100">
        {topKeys.map(([key, val]) => (
          <div key={key} className="px-5 py-3 flex items-center justify-between gap-4">
            <span className="text-sm font-medium text-slate-500">{FIELD_LABELS[key] ?? key}</span>
            <span className="text-sm text-slate-900 text-right truncate max-w-[60%]">{String(val)}</span>
          </div>
        ))}
        {hasAddress && Object.entries((profile!.address as Record<string, string>)).map(([k, v]) => (
          <div key={`addr.${k}`} className="px-5 py-3 flex items-center justify-between gap-4">
            <span className="text-sm font-medium text-slate-500">Address — {k}</span>
            <span className="text-sm text-slate-900 text-right truncate max-w-[60%]">{String(v)}</span>
          </div>
        ))}
      </div>

      <div className="text-xs text-slate-400 flex items-start gap-1.5">
        <svg className="w-3.5 h-3.5 shrink-0 mt-0.5 text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
        <span>Sensitive fields (SSN, passport, driver&apos;s license) are never included in profile exports.</span>
      </div>

      {Object.keys(flat).length === 0 && (
        <p className="text-sm text-slate-400 text-center py-4">No fields to import.</p>
      )}

      <button
        onClick={handleImport}
        className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors active:scale-[0.98]"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
        </svg>
        Import to my profile
      </button>
    </div>
  );
}

export default function ProfileImportPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="bg-white border-b border-slate-100 px-4 sm:px-6 py-3">
        <div className="max-w-lg mx-auto flex items-center gap-2">
          <Link href="/" className="text-lg font-extrabold text-slate-900">
            Form<span className="text-blue-600">Pilot</span>
          </Link>
        </div>
      </nav>
      <main className="max-w-lg mx-auto px-4 sm:px-6 py-8 sm:py-10">
        <Suspense fallback={<div className="flex justify-center py-20"><svg className="w-8 h-8 animate-spin text-slate-400" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" /><path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-75" /></svg></div>}>
          <ProfileImportInner />
        </Suspense>
      </main>
    </div>
  );
}
