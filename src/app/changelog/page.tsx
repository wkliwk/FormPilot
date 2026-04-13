import type { Metadata } from "next";
import { readFileSync } from "fs";
import { join } from "path";
import { remark } from "remark";
import remarkHtml from "remark-html";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Changelog — FormPilot",
  description: "What's new in FormPilot — release notes and updates.",
};

export default async function ChangelogPage() {
  const filePath = join(process.cwd(), "CHANGELOG.md");
  const raw = readFileSync(filePath, "utf8");
  const processed = await remark().use(remarkHtml, { sanitize: true }).process(raw);
  const html = processed.toString();

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
          <h1 className="text-3xl font-bold text-slate-900">Changelog</h1>
          <p className="text-sm text-slate-500">What&apos;s new in FormPilot</p>
        </header>

        <div
          className="changelog-content text-slate-700 leading-relaxed space-y-6"
          dangerouslySetInnerHTML={{ __html: html }}
        />
        <style>{`
          .changelog-content h2 { font-size: 1.125rem; font-weight: 700; color: #0f172a; margin-bottom: 0.75rem; padding-bottom: 0.5rem; border-bottom: 1px solid #e2e8f0; }
          .changelog-content ul { list-style: disc; padding-left: 1.5rem; margin-top: 0.5rem; }
          .changelog-content li { margin-bottom: 0.375rem; }
          .changelog-content strong { color: #0f172a; font-weight: 600; }
          .changelog-content p { margin-bottom: 0.75rem; }
        `}</style>
      </div>
    </main>
  );
}
