import Link from "next/link";

interface ProfileCategory {
  name: string;
  filled: boolean;
  weight: number;
}

interface Props {
  score: number;
  missingCategories: string[];
}

export default function ProfileCompletenessCard({ score, missingCategories }: Props) {
  if (score >= 100) return null;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-soft p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Profile {score}% complete</h3>
              <p className="text-xs text-slate-500">More data = better autofill accuracy</p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="h-1.5 bg-slate-100 rounded-full mb-3 overflow-hidden">
            <div
              className="h-full rounded-full bg-blue-500 transition-all duration-500"
              style={{ width: `${score}%` }}
            />
          </div>

          {/* Missing categories */}
          {missingCategories.length > 0 && (
            <p className="text-xs text-slate-500">
              <span className="font-medium text-slate-700">Missing: </span>
              {missingCategories.join(", ")}
            </p>
          )}
        </div>

        <Link
          href="/dashboard/profile"
          className="shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 text-white text-xs font-semibold rounded-xl hover:bg-blue-700 transition-colors active:scale-[0.98] whitespace-nowrap"
        >
          Complete profile
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="5" y1="12" x2="19" y2="12" />
            <polyline points="12 5 19 12 12 19" />
          </svg>
        </Link>
      </div>
    </div>
  );
}

/*
 * Score calculation (used in dashboard/page.tsx):
 *
 * Weighted categories — higher weight = more commonly used across real form types.
 *   Identity (name)         weight 3  — used on virtually every form
 *   Contact (email+phone)   weight 3  — used on virtually every form
 *   Address                 weight 3  — tax, immigration, HR
 *   Date of birth           weight 2  — healthcare, immigration
 *   Employment              weight 2  — tax, HR
 *   Identity documents      weight 1  — only some forms (passport, SSN, etc.)
 *
 * Total weight = 14
 * Score = round(filledWeight / 14 * 100)
 * A category is "filled" when its representative/key fields are non-empty.
 */
export type { ProfileCategory };
