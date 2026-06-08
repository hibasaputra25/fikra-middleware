import { Card } from "./Card";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  trend?: { value: string; positive: boolean };
  className?: string;
}

export default function StatCard({ label, value, icon: Icon, trend, className }: StatCardProps) {
  return (
    <Card className={cn("flex items-start justify-between", className)}>
      <div>
        <p className="text-sm text-text-secondary">{label}</p>
        <p className="font-display text-3xl font-semibold text-text-primary mt-1 tracking-tight">{value}</p>
        {trend && (
          <p
            className={cn(
              "text-xs mt-1 font-medium",
              trend.positive ? "text-success" : "text-danger"
            )}
          >
            {trend.positive ? "↑" : "↓"} {trend.value}
          </p>
        )}
      </div>
      {Icon && (
        <div className="p-2 bg-primary-light rounded-lg">
          <Icon className="w-5 h-5 text-primary" />
        </div>
      )}
    </Card>
  );
}