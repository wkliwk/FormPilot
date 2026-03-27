import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy — FormPilot",
  description: "How FormPilot collects, uses, and protects your data.",
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-white px-4 py-12">
      <div className="max-w-2xl mx-auto space-y-8">
        <header className="space-y-2">
          <Link
            href="/"
            className="text-sm text-indigo-600 hover:text-indigo-800 transition-colors"
          >
            &larr; Back to FormPilot
          </Link>
          <h1 className="text-3xl font-bold text-slate-900">Privacy Policy</h1>
          <p className="text-sm text-slate-500">Last updated: March 27, 2026</p>
        </header>

        <section className="space-y-4 text-slate-700 leading-relaxed">
          <h2 className="text-xl font-semibold text-slate-900">
            1. What FormPilot Does
          </h2>
          <p>
            FormPilot is an AI-powered form assistant. It helps you understand
            form fields in plain language and auto-fill them from your saved
            profile. It works on PDF and Word documents and on web forms via the
            FormPilot Chrome extension.
          </p>
        </section>

        <section className="space-y-4 text-slate-700 leading-relaxed">
          <h2 className="text-xl font-semibold text-slate-900">
            2. Data We Collect
          </h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong>Account information:</strong> Your name and email address
              from Google OAuth when you sign in.
            </li>
            <li>
              <strong>Profile data:</strong> Personal details you voluntarily
              provide (e.g., address, phone number, employer) to enable
              autofill. This data is stored in our database and used only to
              populate forms on your behalf.
            </li>
            <li>
              <strong>Form content:</strong> When you upload a form or use the
              extension on a web page, the field labels and metadata are sent to
              our AI provider (Anthropic) to generate explanations. We do not
              store uploaded PDF/Word file contents after analysis. Web form
              field data is processed transiently and not persisted.
            </li>
            <li>
              <strong>Usage data:</strong> Basic server logs (request
              timestamps, response codes) for debugging and reliability. No
              third-party analytics are used.
            </li>
          </ul>
        </section>

        <section className="space-y-4 text-slate-700 leading-relaxed">
          <h2 className="text-xl font-semibold text-slate-900">
            3. Chrome Extension
          </h2>
          <p>
            The FormPilot Chrome extension reads form fields on the active tab
            only when you click &ldquo;Scan Form Fields.&rdquo; It does not
            monitor your browsing activity, collect visited URLs, or read page
            content outside of form field detection.
          </p>
          <p>
            The extension communicates exclusively with the FormPilot backend
            (formpilot-brown.vercel.app) using your authenticated session
            cookie. No data is sent to any other third-party service from the
            extension.
          </p>
        </section>

        <section className="space-y-4 text-slate-700 leading-relaxed">
          <h2 className="text-xl font-semibold text-slate-900">
            4. AI Processing
          </h2>
          <p>
            Field analysis is powered by Anthropic&apos;s Claude API. Form
            field labels and metadata (not your filled-in values) are sent to
            Anthropic for processing. Anthropic&apos;s use of this data is
            governed by their{" "}
            <a
              href="https://www.anthropic.com/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-600 hover:text-indigo-800 underline"
            >
              Privacy Policy
            </a>
            .
          </p>
        </section>

        <section className="space-y-4 text-slate-700 leading-relaxed">
          <h2 className="text-xl font-semibold text-slate-900">
            5. Data Sharing
          </h2>
          <p>We do not sell your personal data. We share data only with:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong>Anthropic</strong> — for AI field analysis (field metadata
              only, not profile values).
            </li>
            <li>
              <strong>Vercel</strong> — for hosting and infrastructure.
            </li>
            <li>
              <strong>Railway</strong> — for database hosting (PostgreSQL).
            </li>
          </ul>
        </section>

        <section className="space-y-4 text-slate-700 leading-relaxed">
          <h2 className="text-xl font-semibold text-slate-900">
            6. Data Retention and Deletion
          </h2>
          <p>
            Your account and profile data are retained until you delete your
            account. To request deletion of your data, contact us at the email
            below and we will remove your account within 30 days.
          </p>
        </section>

        <section className="space-y-4 text-slate-700 leading-relaxed">
          <h2 className="text-xl font-semibold text-slate-900">7. Security</h2>
          <p>
            Data in transit is encrypted via HTTPS. Profile data at rest is
            stored in a private PostgreSQL database. We use session-based
            authentication (NextAuth v5) with secure, HttpOnly cookies.
          </p>
        </section>

        <section className="space-y-4 text-slate-700 leading-relaxed">
          <h2 className="text-xl font-semibold text-slate-900">8. Contact</h2>
          <p>
            For privacy questions or data deletion requests, contact us at{" "}
            <a
              href="mailto:privacy@formpilot.app"
              className="text-indigo-600 hover:text-indigo-800 underline"
            >
              privacy@formpilot.app
            </a>
            .
          </p>
        </section>
      </div>
    </main>
  );
}
