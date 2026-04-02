import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type ProjectStatus =
  | "ACTIVE"
  | "DEPLOYING"
  | "FAILED"
  | "ROLLED_BACK"
  | "PENDING";

const styles: Record<
  ProjectStatus,
  { className: string; pulse?: boolean }
> = {
  ACTIVE: { className: "bg-emerald-600/15 text-emerald-700 dark:text-emerald-400 border-emerald-600/30" },
  DEPLOYING: {
    className: "bg-cyan-600/15 text-cyan-700 dark:text-cyan-400 border-cyan-600/30 animate-pulse",
    pulse: true,
  },
  FAILED: { className: "bg-red-600/15 text-red-700 dark:text-red-400 border-red-600/30" },
  ROLLED_BACK: { className: "bg-muted text-muted-foreground border-border" },
  PENDING: { className: "bg-amber-500/15 text-amber-800 dark:text-amber-400 border-amber-500/30" },
};

export function StatusBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  const key = (status in styles ? status : "PENDING") as ProjectStatus;
  const s = styles[key];
  return (
    <Badge variant="outline" className={cn("font-medium", s.className, className)}>
      {status}
    </Badge>
  );
}
