import Link from "next/link";

interface Props {
  formsUsed: number;
  limit: number;
  isPro: boolean;
}

export default function QuotaBar({ formsUsed, limit, isPro }: Props) {
  if (isPro) {
    return (
      <div className="bg-slate-50 border-b border-slate-100">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-2.5">
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
            Pro
          </span>
          <p className="text-sm text-slate-600">Unlimited plan — no limits</p>
        </div>
      </div>
    );
  }

  const pct = Math.min(Math.round((formsUsed / limit) * 100), 100);
  const isLow = formsUsed >= 3 && formsUsed < limit;
  const isAtLimit = formsUsed >= limit;

  let barColor: string;
  let bgColor: string;
  let borderColor: string;

  if (isAtLimit) {
    barColor = "bg-red-500";
    bgColor = "bg-red-50";
    borderColor = "border-red-100";
  } else if (isLow) {
    barColor = "bg-amber-400";
    bgColor = "bg-amber-50";
    borderColor = "border-amber-100";
  } else {
    barColor = "bg-slate-400";
    bgColor = "bg-slate-50";
    borderColor = "border-slate-100";
  }

  return (
    <div className={`${bgColor} border-b ${borderColor}`}>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <p
                className={`text-sm font-medium ${
                  isAtLimit
                    ? "text-red-800"
                    : isLow
                    ? "text-amber-800"
                    : "text-slate-700"
                }`}
              >
                {formsUsed} of {limit} forms used this month
              </p>
              <span
                className={`text-xs font-medium tabular-nums ${
                  isAtLimit
                    ? "text-red-600"
                    : isLow
                    ? "text-amber-600"
                    : "text-slate-500"
                }`}
              >
                {pct}%
              </span>
            </div>
            <div
              className="w-full bg-white rounded-full h-1.5 overflow-hidden"
              role="progressbar"
              aria-valuenow={formsUsed}
              aria-valuemin={0}
              aria-valuemax={limit}
              aria-label={`${formsUsed} of ${limit} forms used this month`}
            >
              <div
                className={`h-1.5 rounded-full transition-all duration-300 ${barColor}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
          {isAtLimit && (
            <Link
              href="/dashboard/billing"
              className="shrink-0 inline-flex items-center justify-center px-3.5 py-1.5 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-700 transition-colors active:scale-[0.98]"
            >
              Upgrade to continue
            </Link>
          )}
          {isLow && (
            <Link
              href="/dashboard/billing"
              className="shrink-0 text-xs font-semibold text-amber-700 hover:text-amber-900 underline underline-offset-2 transition-colors"
            >
              Running low — upgrade for unlimited
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
