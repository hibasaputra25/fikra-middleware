import { cn } from "@/lib/utils";

interface ScoreBarProps {
  label: string;
  code: string;
  score: number;
  maxScore?: number;
  detail?: string;
}

export default function ScoreBar({ label, code, score, maxScore = 1000, detail }: ScoreBarProps) {
  const percentage = Math.min((score / maxScore) * 100, 100);

  const getBarColor = (score: number) => {
    if (score >= 700) return "bg-success";
    if (score >= 500) return "bg-warning";
    return "bg-danger";
  };

  return (
    <div className="flex items-center gap-3 py-2">
      <div className="w-10 shrink-0">
        <span className="text-xs font-medium text-text-secondary">{code}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm text-text-primary truncate">{label}</span>
          <span className="text-sm font-medium text-text-primary ml-2">{score}</span>
        </div>
        <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={cn("h-full rounded-full transition-all duration-500", getBarColor(score))}
            style={{ width: `${percentage}%` }}
          />
        </div>
        {detail && (
          <span className="text-xs text-text-muted mt-0.5">{detail}</span>
        )}
      </div>
    </div>
  );
}