interface Props {
  totalFieldsFilled: number;
  totalTimeSavedSeconds: number;
  formsCompleted: number;
  isPro: boolean;
  formsUsedThisMonth: number;
  freeFormLimit: number;
}

function formatTimeSaved(seconds: number): string {
  if (seconds < 60) return "< 1 min";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
}

export default function DashboardStats({
  totalFieldsFilled,
  totalTimeSavedSeconds,
  formsCompleted,
  isPro,
  formsUsedThisMonth,
  freeFormLimit,
}: Props) {
  const items = [
    {
      label: "Fields filled",
      value: totalFieldsFilled.toLocaleString(),
    },
    {
      label: "Time saved",
      value: formatTimeSaved(totalTimeSavedSeconds),
    },
    {
      label: "Forms completed",
      value: formsCompleted.toLocaleString(),
    },
    ...(!isPro
      ? [
          {
            label: "Free forms used",
            value: `${formsUsedThisMonth} / ${freeFormLimit}`,
            highlight: formsUsedThisMonth >= freeFormLimit,
          },
        ]
      : []),
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {items.map((item) => (
        <div
          key={item.label}
          className={`rounded-xl border px-4 py-3 ${
            "highlight" in item && item.highlight
              ? "bg-amber-50 border-amber-200"
              : "bg-white border-slate-200"
          }`}
        >
          <p className="text-xs text-slate-500 font-medium">{item.label}</p>
          <p
            className={`text-xl font-bold mt-0.5 ${
              "highlight" in item && item.highlight ? "text-amber-700" : "text-slate-900"
            }`}
          >
            {item.value}
          </p>
          {"highlight" in item && item.highlight && (
            <a
              href="/dashboard/billing"
              className="text-xs text-amber-600 hover:text-amber-800 font-medium underline underline-offset-2 mt-1 inline-block"
            >
              Upgrade for unlimited
            </a>
          )}
        </div>
      ))}
    </div>
  );
}
