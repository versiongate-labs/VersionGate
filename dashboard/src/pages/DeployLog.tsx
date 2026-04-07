import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { createWebSocket, getJobStatus } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/PageHeader";
import { AlertTriangle } from "lucide-react";

type LineKind = "info" | "success" | "error";

function classifyLine(line: string): LineKind {
  const lower = line.toLowerCase();
  if (lower.includes("failed") || lower.includes("error") || lower.includes("fatal")) return "error";
  if (lower.includes("successful") || lower.includes("complete") || lower.includes("✓")) return "success";
  return "info";
}

const POLL_MS = 2000;
const STUCK_PENDING_MS = 8000;

export function DeployLog() {
  const { id: projectId, jobId } = useParams<{ id: string; jobId: string }>();
  const [lines, setLines] = useState<string[]>([]);
  const [jobStatus, setJobStatus] = useState<string>("RUNNING");
  const [jobError, setJobError] = useState<string | null>(null);
  const [pendingSince, setPendingSince] = useState<number | null>(null);
  const [clock, setClock] = useState(() => Date.now());
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (jobStatus !== "PENDING" || pendingSince == null) return;
    const id = window.setInterval(() => setClock(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [jobStatus, pendingSince]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines]);

  useEffect(() => {
    if (!jobId) return;

    let ws: WebSocket | null = null;
    let cancelled = false;
    let pollTimer: ReturnType<typeof setInterval> | undefined;

    void (async () => {
      try {
        const initial = await getJobStatus(jobId);
        if (cancelled) return;
        const logs = Array.isArray(initial.job.logs) ? (initial.job.logs as string[]) : [];
        setLines(logs);
        setJobStatus(initial.job.status);
        setJobError(initial.job.error ?? null);
        if (initial.job.status === "PENDING") {
          setPendingSince(Date.now());
        }
      } catch {
        setJobStatus("FAILED");
      }

      const refresh = async () => {
        try {
          const j = await getJobStatus(jobId);
          if (cancelled) return;
          setJobStatus(j.job.status);
          setJobError(j.job.error ?? null);
          const logs = Array.isArray(j.job.logs) ? (j.job.logs as string[]) : [];
          setLines((prev) => (logs.length > prev.length ? logs : prev));
          if (j.job.status === "PENDING") {
            setPendingSince((t) => t ?? Date.now());
          } else {
            setPendingSince(null);
          }
        } catch {
          /* keep polling */
        }
      };

      pollTimer = setInterval(() => {
        void refresh();
      }, POLL_MS);

      ws = createWebSocket(jobId);
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data as string) as {
            type?: string;
            line?: string;
            status?: string;
          };
          if (msg.type === "log" && msg.line) {
            setLines((prev) => [...prev, msg.line!]);
          }
          if (msg.type === "status" && msg.status) {
            setJobStatus(msg.status);
            if (msg.status !== "PENDING") setPendingSince(null);
          }
        } catch {
          /* ignore */
        }
      };
      ws.onerror = () => {
        /* polling still updates */
      };
    })();

    return () => {
      cancelled = true;
      if (pollTimer) clearInterval(pollTimer);
      ws?.close();
    };
  }, [jobId]);

  const showWorkerHint =
    jobStatus === "PENDING" && pendingSince != null && clock - pendingSince > STUCK_PENDING_MS;

  const badgeVariant =
    jobStatus === "COMPLETE"
      ? "default"
      : jobStatus === "FAILED" || jobStatus === "CANCELLED"
        ? "destructive"
        : "secondary";

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <PageHeader
          title="Deploy log"
          description="Streaming output from the worker. If this stays empty, confirm versiongate-worker is running (pm2) and check API logs."
        />
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={badgeVariant} className="shrink-0 font-mono text-xs">
            {jobStatus}
          </Badge>
          {jobId ? (
            <span className="font-mono text-xs text-muted-foreground">
              job {jobId.slice(0, 8)}…
            </span>
          ) : null}
        </div>
      </div>

      {showWorkerHint ? (
        <Alert className="border-amber-500/40 bg-amber-500/10">
          <AlertTriangle className="size-4 text-amber-400" />
          <AlertTitle>Job still queued</AlertTitle>
          <AlertDescription>
            Nothing has started yet. On the server run{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">pm2 list</code> and ensure{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">versiongate-worker</code> is online. Restart with{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">pm2 restart versiongate-worker</code>.
          </AlertDescription>
        </Alert>
      ) : null}

      {jobError ? (
        <Alert variant="destructive">
          <AlertTitle>Job error</AlertTitle>
          <AlertDescription className="font-mono text-xs whitespace-pre-wrap">{jobError}</AlertDescription>
        </Alert>
      ) : null}

      {projectId && (
        <div className="flex flex-wrap gap-3 text-sm">
          <Link to={`/projects/${projectId}`} className="text-muted-foreground hover:text-primary">
            ← Project
          </Link>
          <Link to="/activity" className="text-muted-foreground hover:text-primary">
            All activity →
          </Link>
        </div>
      )}

      <Card className="overflow-hidden border-border/50 bg-card/40 ring-1 ring-border/30">
        <CardHeader className="border-b border-border/40 py-3">
          <CardTitle className="font-mono text-xs font-normal uppercase tracking-wider text-muted-foreground">
            Output
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <pre
            className="min-h-[50vh] max-h-[min(75vh,720px)] w-full overflow-auto bg-black/60 p-4 font-mono text-xs leading-relaxed md:p-6 md:text-sm"
            style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}
          >
            {lines.length === 0 ? (
              <span className="text-muted-foreground">
                {jobStatus === "PENDING"
                  ? "Waiting for worker to pick up this job…"
                  : jobStatus === "RUNNING"
                    ? "Starting…"
                    : "No log lines yet."}
              </span>
            ) : null}
            {lines.map((line, i) => {
              const kind = classifyLine(line);
              return (
                <div
                  key={`${i}-${line.slice(0, 24)}`}
                  className={cn(
                    kind === "success" && "text-emerald-400",
                    kind === "error" && "text-red-400",
                    kind === "info" && "text-zinc-300"
                  )}
                >
                  {line}
                </div>
              );
            })}
            <div ref={bottomRef} />
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}
