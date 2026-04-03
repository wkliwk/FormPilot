interface ProgressRingProps {
  score: number; // 0–100
  size?: number; // diameter in px, default 32
  strokeWidth?: number;
}

function getRingColor(score: number) {
  if (score >= 80) return "#10b981"; // emerald-500
  if (score >= 50) return "#f59e0b"; // amber-500
  return "#94a3b8"; // slate-400
}

export default function ProgressRing({ score, size = 32, strokeWidth = 3 }: ProgressRingProps) {
  if (score < 0) return null;

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = getRingColor(score);
  const fontSize = size <= 32 ? 9 : size <= 48 ? 12 : 14;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-label={`${score}% complete`}
      role="img"
    >
      {/* Background track */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="#e2e8f0"
        strokeWidth={strokeWidth}
      />
      {/* Progress arc */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: "stroke-dashoffset 0.4s ease" }}
      />
      {/* Percentage label */}
      <text
        x={size / 2}
        y={size / 2}
        dominantBaseline="central"
        textAnchor="middle"
        fill={score === 0 ? "#94a3b8" : color}
        fontSize={fontSize}
        fontWeight="600"
        fontFamily="system-ui, sans-serif"
      >
        {score}
      </text>
    </svg>
  );
}
