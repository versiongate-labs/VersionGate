import { useEffect, useState } from "react";
import { getServerStats, type ServerStats } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";

export function Server() {
  const [stats, setStats] = useState<ServerStats | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const s = await getServerStats();
        if (!cancelled) setStats(s);
      } catch {
        if (!cancelled) setStats(null);
      }
    };
    void load();
    const id = window.setInterval(load, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  if (!stats) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
      </div>
    );
  }

  const fmt = (n: number) =>
    n >= 1e9 ? `${(n / 1e9).toFixed(2)} GB` : n >= 1e6 ? `${(n / 1e6).toFixed(2)} MB` : `${Math.round(n)} B`;

  return (
    <div className="space-y-6 max-w-4xl">
      <h1 className="text-2xl font-semibold">Server</h1>
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">CPU</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-2xl font-semibold tabular-nums">{stats.cpu_percent.toFixed(1)}%</div>
            <Progress value={Math.min(100, stats.cpu_percent)} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Memory</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-2xl font-semibold tabular-nums">{stats.memory_percent.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              {fmt(stats.memory_used)} / {fmt(stats.memory_total)}
            </p>
            <Progress value={Math.min(100, stats.memory_percent)} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Disk</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-2xl font-semibold tabular-nums">{stats.disk_percent.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              {fmt(stats.disk_used)} / {fmt(stats.disk_total)}
            </p>
            <Progress value={Math.min(100, stats.disk_percent)} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Network (cumulative)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <div>
              Sent: <span className="font-mono tabular-nums">{fmt(stats.network_sent)}</span>
            </div>
            <div>
              Recv: <span className="font-mono tabular-nums">{fmt(stats.network_recv)}</span>
            </div>
            <p className="text-xs text-muted-foreground pt-2">Uptime: {Math.floor(stats.uptime)}s</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
