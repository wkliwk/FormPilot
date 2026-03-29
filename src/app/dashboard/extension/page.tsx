import Link from "next/link";

export const metadata = { title: "Install Chrome Extension — FormPilot" };

const STEPS = [
  {
    number: 1,
    title: "Download the extension",
    description: (
      <>
        Click the button below to download{" "}
        <strong className="text-slate-900">formpilot-extension.zip</strong>. Save it
        somewhere you&apos;ll remember — your Downloads folder is fine.
      </>
    ),
    icon: (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </svg>
    ),
  },
  {
    number: 2,
    title: "Unzip the file",
    description: (
      <>
        Extract the ZIP file. You should get a folder named{" "}
        <strong className="text-slate-900">formpilot-extension</strong> (or similar)
        containing a <code className="text-xs bg-slate-100 px-1 py-0.5 rounded">manifest.json</code> file.
      </>
    ),
    icon: (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
      </svg>
    ),
  },
  {
    number: 3,
    title: 'Open Chrome Extensions',
    description: (
      <>
        In Chrome, go to{" "}
        <code className="text-xs bg-slate-100 px-1 py-0.5 rounded">chrome://extensions</code>{" "}
        in the address bar (or open the Chrome menu → <strong className="text-slate-900">More tools</strong> →{" "}
        <strong className="text-slate-900">Extensions</strong>).
      </>
    ),
    icon: (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.07 4.93l-1.41 1.41M5.34 5.34L3.93 6.75M21 12h-2M5 12H3M19.07 19.07l-1.41-1.41M5.34 18.66l-1.41 1.41M12 21v-2M12 5V3" />
      </svg>
    ),
  },
  {
    number: 4,
    title: "Enable Developer Mode",
    description: (
      <>
        In the top-right corner of the Extensions page, toggle{" "}
        <strong className="text-slate-900">Developer mode</strong> on. A new toolbar will
        appear with a &ldquo;Load unpacked&rdquo; button.
      </>
    ),
    icon: (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="16 18 22 12 16 6" />
        <polyline points="8 6 2 12 8 18" />
      </svg>
    ),
  },
  {
    number: 5,
    title: 'Click "Load unpacked"',
    description: (
      <>
        Click <strong className="text-slate-900">Load unpacked</strong> and select the{" "}
        <strong className="text-slate-900">formpilot-extension</strong> folder you
        extracted in Step 2. The extension will appear in your list.
      </>
    ),
    icon: (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 15v4c0 1.1.9 2 2 2h14a2 2 0 002-2v-4M17 8l-5-5-5 5M12 3v12" />
      </svg>
    ),
  },
  {
    number: 6,
    title: "Pin the extension",
    description: (
      <>
        Click the puzzle icon in Chrome&apos;s toolbar, then click the pin{" "}
        <svg className="inline w-3.5 h-3.5 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /></svg>{" "}
        next to <strong className="text-slate-900">FormPilot</strong> so it stays visible in
        your toolbar.
      </>
    ),
    icon: (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
      </svg>
    ),
  },
];

export default function ExtensionPage() {
  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-8">
      {/* Header */}
      <div className="space-y-3">
        <div className="inline-flex items-center gap-2 text-xs font-medium text-blue-600 bg-blue-50 px-3 py-1 rounded-full">
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><polyline points="12 8 12 12 14 14" />
          </svg>
          Beta — sideload required until Chrome Web Store listing
        </div>
        <h1 className="text-2xl font-bold text-slate-900">Install the Chrome Extension</h1>
        <p className="text-slate-500">
          FormPilot&apos;s extension detects form fields on <strong className="text-slate-700">any web page</strong> —
          government sites, HR portals, bank applications, you name it — and opens your
          AI assistant in a side panel so you can fill fields with confidence.
        </p>
      </div>

      {/* Download CTA */}
      <div className="bg-blue-600 rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex-1">
          <p className="font-semibold text-white text-lg">FormPilot for Chrome</p>
          <p className="text-blue-200 text-sm mt-0.5">Works on any web form. Free while in beta.</p>
        </div>
        <a
          href="/api/extension/download"
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-white text-blue-700 font-semibold rounded-xl text-sm hover:bg-blue-50 transition-colors shrink-0 active:scale-[0.98]"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Download ZIP
        </a>
      </div>

      {/* Steps */}
      <div>
        <h2 className="text-lg font-semibold text-slate-900 mb-5">Installation steps</h2>
        <ol className="space-y-4">
          {STEPS.map((step) => (
            <li key={step.number} className="flex gap-4 bg-white rounded-xl border border-slate-200 p-4 sm:p-5">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-slate-50 text-slate-500 shrink-0 mt-0.5">
                {step.icon}
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                    Step {step.number}
                  </span>
                  <h3 className="font-semibold text-slate-900">{step.title}</h3>
                </div>
                <p className="text-sm text-slate-500 leading-relaxed">{step.description}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>

      {/* What it does */}
      <div className="bg-slate-50 rounded-2xl border border-slate-200 p-6 space-y-4">
        <h2 className="font-semibold text-slate-900">What the extension does</h2>
        <ul className="space-y-3 text-sm text-slate-600">
          {[
            "Detects form fields on any web page automatically",
            "Opens a FormPilot side panel — no tab switching",
            "Explains each field in plain language",
            "Auto-fills from your saved profile",
            "Works on government portals, HR systems, banking sites, and more",
            "Your data never leaves your browser except to fill forms",
          ].map((item) => (
            <li key={item} className="flex items-start gap-2.5">
              <svg className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              {item}
            </li>
          ))}
        </ul>
      </div>

      {/* Troubleshooting */}
      <div className="space-y-3">
        <h2 className="font-semibold text-slate-900">Troubleshooting</h2>
        <div className="space-y-3 text-sm text-slate-600">
          <details className="bg-white border border-slate-200 rounded-xl">
            <summary className="px-4 py-3 font-medium text-slate-700 cursor-pointer hover:text-slate-900 select-none">
              The extension icon doesn&apos;t appear
            </summary>
            <p className="px-4 pb-4 text-slate-500">
              Click the puzzle icon <strong>⧫</strong> in Chrome&apos;s toolbar and make sure
              FormPilot is enabled. You can pin it for quick access.
            </p>
          </details>
          <details className="bg-white border border-slate-200 rounded-xl">
            <summary className="px-4 py-3 font-medium text-slate-700 cursor-pointer hover:text-slate-900 select-none">
              &ldquo;Manifest file is missing or unreadable&rdquo; error
            </summary>
            <p className="px-4 pb-4 text-slate-500">
              Make sure you selected the <em>extracted folder</em>, not the ZIP file
              itself. The folder should contain a{" "}
              <code className="text-xs bg-slate-100 px-1 rounded">manifest.json</code> file
              at its root.
            </p>
          </details>
          <details className="bg-white border border-slate-200 rounded-xl">
            <summary className="px-4 py-3 font-medium text-slate-700 cursor-pointer hover:text-slate-900 select-none">
              The side panel doesn&apos;t open when I click the icon
            </summary>
            <p className="px-4 pb-4 text-slate-500">
              Make sure you&apos;re logged in to FormPilot at{" "}
              <Link href="/dashboard" className="text-blue-600 hover:underline">
                formpilot.app/dashboard
              </Link>
              . The extension uses your existing session.
            </p>
          </details>
        </div>
      </div>
    </main>
  );
}
