import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { RefreshCw, ScrollText } from "lucide-react";
import { listAllJobs, type JobRecord } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

const POLL_MS = 8000;

export function Activity() {
  const [jobs, setJobs] = useState<JobRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const r = await listAllJobs({ limit: 100 });
      setJobs(r.jobs);
      setTotal(r.total);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load jobs");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), POLL_MS);
    return () => window.clearInterval(id);
  }, [load]);

  const badgeFor = (status: string) => {
    if (status === "FAILED" || status === "CANCELLED") return "destructive" as const;
    if (status === "COMPLETE") return "default" as const;
    return "secondary" as const;
  };

  return (
    <div className="w-full space-y-8">
      <PageHeader
        title="Activity"
        description="Central log of deploy and rollback jobs across all projects. Refreshes every few seconds."
        actions={
          <Button type="button" variant="outline" size="sm" className="gap-2" onClick={() => void load()}>
            <RefreshCw className="size-3.5" />
            Refresh
          </Button>
        }
      />

      <Card className="border-border/50 bg-card/50 ring-1 ring-border/25">
        <CardHeader className="border-b border-border/40">
          <CardTitle>Jobs</CardTitle>
          <CardDescription>
            Open any row to stream logs. If a job stays <span className="font-mono">PENDING</span>, ensure the worker
            process is running (
            <code className="rounded bg-muted px-1 py-0.5 text-xs">pm2 list</code> →{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">versiongate-worker</code>).
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0 pt-4">
          {loading && jobs.length === 0 ? (
            <div className="space-y-2 px-6 pb-6">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-border/50 hover:bg-transparent">
                  <TableHead className="pl-6">When</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="pr-6 text-right">Logs</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-16 text-center text-muted-foreground">
                      No jobs yet. Deploy a project from the Deployments page.
                    </TableCell>
                  </TableRow>
                ) : (
                  jobs.map((job) => (
                    <TableRow key={job.id} className="border-border/40">
                      <TableCell className="pl-6 text-sm text-muted-foreground">
                        {new Date(job.createdAt).toLocaleString()}
                      </TableCell>
                      <TableCell className="font-medium">
                        {job.project?.name ?? "—"}
                        <div className="font-mono text-xs text-muted-foreground">{job.project?.id ?? job.projectId}</div>
                      </TableCell>
                      <TableCell className="font-mono text-sm">{job.type}</TableCell>
                      <TableCell>
                        <Badge variant={badgeFor(job.status)} className="font-mono text-xs">
                          {job.status}
                        </Badge>
                        {job.error ? (
                          <p className="mt-1 max-w-md truncate text-xs text-red-400" title={job.error}>
                            {job.error}
                          </p>
                        ) : null}
                      </TableCell>
                      <TableCell className="pr-6 text-right">
                        <Link
                          to={`/projects/${job.projectId}/deploy/${job.id}`}
                          className={buttonVariants({ variant: "outline", size: "sm", className: "gap-1" })}
                        >
                          <ScrollText className="size-3.5" />
                          Open log
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
          {!loading && total > 0 ? (
            <p className="border-t border-border/40 px-6 py-3 text-xs text-muted-foreground">
              Showing {jobs.length} of {total} jobs
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
