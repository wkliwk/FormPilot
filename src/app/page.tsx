import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-white to-blue-50 px-4">
      <div className="max-w-3xl w-full text-center space-y-8">
        <div className="space-y-4">
          <h1 className="text-5xl font-bold text-slate-900">
            Form<span className="text-blue-600">Pilot</span>
          </h1>
          <p className="text-xl text-slate-600 max-w-2xl mx-auto">
            Upload any form — tax, visa, government, HR — and get plain-language
            field explanations, smart autofill, and guided completion.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/dashboard"
            className="px-8 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
          >
            Get Started
          </Link>
          <Link
            href="/login"
            className="px-8 py-3 border border-slate-300 text-slate-700 rounded-lg font-semibold hover:bg-slate-50 transition-colors"
          >
            Sign In
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-8">
          {[
            {
              title: "Upload Any Form",
              description: "PDF, Word, or activate on web forms via browser extension",
              icon: "📄",
            },
            {
              title: "Plain Language Help",
              description: "Every field explained clearly with examples and common mistakes",
              icon: "💡",
            },
            {
              title: "Smart Autofill",
              description: "Fill fields from your secure profile with confidence scoring",
              icon: "⚡",
            },
          ].map((feature) => (
            <div
              key={feature.title}
              className="bg-white rounded-xl p-6 shadow-sm border border-slate-100 text-left space-y-2"
            >
              <div className="text-3xl">{feature.icon}</div>
              <h3 className="font-semibold text-slate-900">{feature.title}</h3>
              <p className="text-sm text-slate-500">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
