import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service — FormPilot",
  description: "Terms and conditions for using FormPilot.",
};

export default function TermsPage() {
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
          <h1 className="text-3xl font-bold text-slate-900">Terms of Service</h1>
          <p className="text-sm text-slate-500">Last updated: March 30, 2026</p>
        </header>

        <section className="space-y-4 text-slate-700 leading-relaxed">
          <h2 className="text-xl font-semibold text-slate-900">1. Service Description</h2>
          <p>
            FormPilot (&ldquo;Service&rdquo;) is an AI-powered form assistant operated by FormPilot (&ldquo;we&rdquo;, &ldquo;us&rdquo;). The Service helps you understand and complete forms — including PDF and Word documents — by providing field explanations, autofill suggestions, and export functionality. Access requires an account.
          </p>
        </section>

        <section className="space-y-4 text-slate-700 leading-relaxed">
          <h2 className="text-xl font-semibold text-slate-900">2. Acceptable Use</h2>
          <p>By using FormPilot, you agree to:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Use the Service only for lawful purposes and in compliance with applicable law.</li>
            <li>Not upload forms or documents that contain illegal content or that you do not have the right to process.</li>
            <li>Not attempt to reverse-engineer, scrape, or abuse the Service&rsquo;s AI features.</li>
            <li>Not share your account credentials with others.</li>
          </ul>
        </section>

        <section className="space-y-4 text-slate-700 leading-relaxed">
          <h2 className="text-xl font-semibold text-slate-900">3. Subscriptions and Payment</h2>
          <p>
            FormPilot offers a <strong>Free plan</strong> (5 form uploads per month) and a <strong>Pro plan</strong> (unlimited uploads, $9/month). Payments are processed by Stripe. Subscriptions renew automatically each month unless cancelled. You may cancel at any time from the Billing page in your dashboard; cancellation takes effect at the end of the current billing period.
          </p>
          <p>
            We reserve the right to change pricing with 30 days&rsquo; notice to active subscribers. Refunds are not issued for partial months.
          </p>
        </section>

        <section className="space-y-4 text-slate-700 leading-relaxed">
          <h2 className="text-xl font-semibold text-slate-900">4. Account Termination</h2>
          <p>
            You may delete your account at any time. We may suspend or terminate accounts that violate these Terms, abuse the Service, or remain inactive for an extended period. On termination, your data is deleted in accordance with our <Link href="/privacy" className="text-indigo-600 hover:text-indigo-800">Privacy Policy</Link>.
          </p>
        </section>

        <section className="space-y-4 text-slate-700 leading-relaxed">
          <h2 className="text-xl font-semibold text-slate-900">5. AI-Generated Content</h2>
          <p>
            FormPilot uses AI to generate field explanations and autofill suggestions. These are provided as assistance only — they are not legal, tax, or professional advice. You are responsible for reviewing all values before submitting any form to a government agency or third party. FormPilot is not liable for errors in AI-generated content.
          </p>
        </section>

        <section className="space-y-4 text-slate-700 leading-relaxed">
          <h2 className="text-xl font-semibold text-slate-900">6. Disclaimer of Warranties</h2>
          <p>
            The Service is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo; without warranties of any kind, either express or implied. We do not warrant that the Service will be uninterrupted, error-free, or that AI suggestions will be accurate or complete.
          </p>
        </section>

        <section className="space-y-4 text-slate-700 leading-relaxed">
          <h2 className="text-xl font-semibold text-slate-900">7. Limitation of Liability</h2>
          <p>
            To the maximum extent permitted by law, FormPilot shall not be liable for any indirect, incidental, special, or consequential damages arising from your use of the Service, including but not limited to errors in autofilled form data, rejected applications, or data loss. Our total liability for any claim shall not exceed the amount you paid us in the 12 months preceding the claim.
          </p>
        </section>

        <section className="space-y-4 text-slate-700 leading-relaxed">
          <h2 className="text-xl font-semibold text-slate-900">8. Changes to Terms</h2>
          <p>
            We may update these Terms from time to time. Material changes will be communicated by email to registered users. Continued use of the Service after changes take effect constitutes acceptance of the revised Terms.
          </p>
        </section>

        <section className="space-y-4 text-slate-700 leading-relaxed">
          <h2 className="text-xl font-semibold text-slate-900">9. Contact</h2>
          <p>
            Questions about these Terms? Email us at{" "}
            <a href="mailto:hello@getformpilot.com" className="text-indigo-600 hover:text-indigo-800">
              hello@getformpilot.com
            </a>
            .
          </p>
        </section>
      </div>
    </main>
  );
}
