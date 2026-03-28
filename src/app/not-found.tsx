import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4">
      <div className="text-center max-w-md">
        {/* Brand */}
        <Link href="/" className="inline-block text-xl font-bold text-slate-900 mb-12">
          Form<span className="text-blue-600">Pilot</span>
        </Link>

        {/* 404 indicator */}
        <div className="flex items-center justify-center w-20 h-20 rounded-2xl bg-blue-50 mx-auto mb-6">
          <span className="text-3xl font-bold text-blue-600" aria-hidden="true">
            404
          </span>
        </div>

        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
          Page not found
        </h1>
        <p className="mt-3 text-slate-500 leading-relaxed">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>

        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors shadow-sm"
          >
            Go to Dashboard
          </Link>
          <Link
            href="/"
            className="inline-flex items-center justify-center px-6 py-3 border border-slate-200 text-slate-700 rounded-xl font-semibold hover:bg-slate-100 hover:border-slate-300 transition-colors"
          >
            Back to Home
          </Link>
        </div>
      </div>
    </main>
  );
}
