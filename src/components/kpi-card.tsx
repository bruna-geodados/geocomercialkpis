import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface KpiCardProps {
  label: string;
  value: string;
  hint?: string;
  icon?: ReactNode;
  tone?: "default" | "success" | "warning" | "danger" | "accent";
  className?: string;
}

const toneStyles: Record<NonNullable<KpiCardProps["tone"]>, string> = {
  default: "text-foreground",
  success: "text-[oklch(0.55_0.14_155)]",
  warning: "text-[oklch(0.72_0.16_70)]",
  danger: "text-destructive",
  accent: "text-accent",
};

export function KpiCard({
  label, value, hint, icon, tone = "default", className,
}: KpiCardProps) {
  return (
    <Card className={cn("p-5 flex flex-col gap-2 border-border/70", className)}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
          {label}
        </span>
        {icon && <span className="text-muted-foreground">{icon}</span>}
      </div>
      <div className={cn("text-2xl font-semibold tabular-nums", toneStyles[tone])}>
        {value}
      </div>
      {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
    </Card>
  );
}