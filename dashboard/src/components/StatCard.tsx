import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export function StatCard({
  label,
  value,
  icon: Icon,
  valueClassName,
  iconClassName,
}: {
  label: string;
  value: number | string;
  icon: LucideIcon;
  valueClassName?: string;
  iconClassName?: string;
}) {
  return (
    <Card className="relative overflow-hidden border-border/50 bg-card/70 shadow-none ring-1 ring-border/30 transition-all hover:ring-primary/20 hover:shadow-md hover:shadow-primary/5">
      <div className="pointer-events-none absolute -right-6 -top-6 size-24 rounded-full bg-primary/[0.03]" />
      <div className="pointer-events-none absolute -right-2 -top-2 size-12 rounded-full bg-primary/[0.04]" />
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground/80">{label}</span>
        <Icon className={cn("size-4 text-muted-foreground/60", iconClassName)} />
      </CardHeader>
      <CardContent>
        <div className={cn("text-3xl font-bold tabular-nums tracking-tight", valueClassName)}>{value}</div>
      </CardContent>
    </Card>
  );
}
