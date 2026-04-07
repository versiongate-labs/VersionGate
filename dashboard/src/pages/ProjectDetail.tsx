import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Copy, ExternalLink, ScrollText } from "lucide-react";
import {
  getDeployments,
  getProject,
  listProjectJobs,
  rollback,
  triggerDeploy,
  type Deployment,
  type JobRecord,
  type Project,
} from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/StatusBadge";
import { SlotBadge } from "@/components/SlotBadge";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Separator } from "@/components/ui/separator";
import { PageHeader } from "@/components/PageHeader";
import { hostPortForSlot, publicServiceUrl } from "@/lib/deployment-display";

function copyText(text: string, label: string) {
  void navigator.clipboard.writeText(text).then(
    () => toast.success(`${label} copied`),
    () => toast.error("Copy failed")
  );
}

export function ProjectDetail() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [jobs, setJobs] = useState<JobRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [p, d, j] = await Promise.all([
        getProject(id),
        getDeployments(id),
        listProjectJobs(id, { limit: 25 }),
      ]);
      setProject(p.project);
      setDeployments(d.deployments);
      setJobs(j.jobs);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load project");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load only when project id changes
  }, [id]);

  const onDeploy = async () => {
    if (!id) return;
    try {
      const r = await triggerDeploy(id);
      toast.success(`Deploy queued — job ${r.jobId.slice(0, 8)}…`);
      navigate(`/projects/${id}/deploy/${r.jobId}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Deploy failed");
    }
  };

  const onRollback = async () => {
    if (!id) return;
    try {
      const r = await rollback(id);
      toast.success(`Rollback queued — job ${r.jobId.slice(0, 8)}…`);
      navigate(`/projects/${id}/deploy/${r.jobId}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Rollback failed");
    }
  };

  if (loading || !project) {
    return (
      <div className="w-full space-y-6">
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
    );
  }

  const active = deployments.find((d) => d.status === "ACTIVE");
  const displayStatus = deployments.some((d) => d.status === "DEPLOYING")
    ? "DEPLOYING"
    : active
      ? "ACTIVE"
      : deployments[0]?.status === "FAILED"
        ? "FAILED"
        : deployments[0]?.status === "ROLLED_BACK"
          ? "ROLLED_BACK"
          : "PENDING";

  const liveHostPort = active ? hostPortForSlot(project, active.color) : null;
  const liveUrl = liveHostPort != null ? publicServiceUrl(liveHostPort) : null;
  const blueUrl = publicServiceUrl(project.basePort);
  const greenUrl = publicServiceUrl(project.basePort + 1);

  return (
    <div className="w-full space-y-8">
      <PageHeader
        title={project.name}
        description={project.repoUrl}
        actions={
          <>
            <a
              href={project.repoUrl}
              target="_blank"
              rel="noreferrer"
              className={buttonVariants({ variant: "outline", size: "sm", className: "gap-1.5" })}
            >
              <ExternalLink className="size-3.5" />
              Repo
            </a>
            <Button onClick={() => void onDeploy()}>Deploy</Button>
            <Button variant="secondary" onClick={() => void onRollback()}>
              Rollback
            </Button>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <code className="rounded-md border border-border/50 bg-muted/30 px-2 py-0.5 font-mono text-xs">{project.branch}</code>
        <span className="text-muted-foreground">·</span>
        <span className="text-muted-foreground">Container listens on</span>
        <code className="rounded-md border border-border/50 bg-muted/30 px-2 py-0.5 font-mono text-xs">{project.appPort}</code>
        <span className="text-muted-foreground">·</span>
        <StatusBadge status={displayStatus} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="border-border/50 bg-card/60 ring-1 ring-border/25 lg:col-span-2">
          <CardHeader>
            <CardTitle>Blue / green traffic</CardTitle>
            <CardDescription>
              Published ports on this host: blue <span className="font-mono">{project.basePort}</span>, green{" "}
              <span className="font-mono">{project.basePort + 1}</span>. Traffic follows the{" "}
              <span className="font-medium text-foreground">ACTIVE</span> deployment&apos;s slot.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-sky-500/25 bg-sky-500/5 p-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <SlotBadge color="BLUE" />
                {active?.color === "BLUE" && (
                  <Badge className="bg-emerald-600/90 text-white hover:bg-emerald-600">LIVE</Badge>
                )}
              </div>
              <p className="font-mono text-sm text-foreground">{blueUrl?.replace(/^https?:\/\//, "")}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => blueUrl && copyText(blueUrl, "URL")}
                >
                  <Copy className="mr-1 size-3" />
                  Copy
                </Button>
                {blueUrl ? (
                  <a href={blueUrl} target="_blank" rel="noreferrer" className={buttonVariants({ variant: "secondary", size: "sm", className: "h-8 text-xs" })}>
                    Open
                  </a>
                ) : null}
              </div>
            </div>
            <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <SlotBadge color="GREEN" />
                {active?.color === "GREEN" && (
                  <Badge className="bg-emerald-600/90 text-white hover:bg-emerald-600">LIVE</Badge>
                )}
              </div>
              <p className="font-mono text-sm text-foreground">{greenUrl?.replace(/^https?:\/\//, "")}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => greenUrl && copyText(greenUrl, "URL")}
                >
                  <Copy className="mr-1 size-3" />
                  Copy
                </Button>
                {greenUrl ? (
                  <a href={greenUrl} target="_blank" rel="noreferrer" className={buttonVariants({ variant: "secondary", size: "sm", className: "h-8 text-xs" })}>
                    Open
                  </a>
                ) : null}
              </div>
            </div>
          </CardContent>
          {liveUrl && active && (
            <CardContent className="border-t border-border/40 pt-4">
              <p className="text-sm text-muted-foreground">
                Current traffic: <SlotBadge color={active.color} /> →{" "}
                <span className="font-mono text-foreground">{liveUrl}</span> (maps host{" "}
                <span className="font-mono">{liveHostPort}</span> → container <span className="font-mono">{project.appPort}</span>)
              </p>
            </CardContent>
          )}
        </Card>

        <Card className="border-border/50 bg-card/60 ring-1 ring-border/25">
          <CardHeader>
            <CardTitle className="text-base">Quick checks</CardTitle>
            <CardDescription>Health path inside the container.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div>
              <span className="text-muted-foreground">Health</span>{" "}
              <code className="rounded bg-muted/50 px-1.5 py-0.5 font-mono text-xs">{project.healthPath}</code>
            </div>
            <div>
              <span className="text-muted-foreground">Build context</span>{" "}
              <code className="rounded bg-muted/50 px-1.5 py-0.5 font-mono text-xs">{project.buildContext}</code>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/50 bg-card/50 ring-1 ring-border/30">
        <CardHeader>
          <CardTitle>Jobs</CardTitle>
          <CardDescription>Deploy and rollback runs — open logs for full output.</CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow className="border-border/50 hover:bg-transparent">
                <TableHead className="pl-6">Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Started</TableHead>
                <TableHead className="pr-6 text-right">Logs</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                    No jobs yet. Deploy to generate logs.
                  </TableCell>
                </TableRow>
              ) : (
                jobs.map((job) => (
                  <TableRow key={job.id} className="border-border/40">
                    <TableCell className="pl-6 font-mono text-sm">{job.type}</TableCell>
                    <TableCell>
                      <Badge variant={job.status === "FAILED" ? "destructive" : "secondary"} className="font-mono text-xs">
                        {job.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {job.startedAt ? new Date(job.startedAt).toLocaleString() : "—"}
                    </TableCell>
                    <TableCell className="pr-6 text-right">
                      <Link
                        to={`/projects/${project.id}/deploy/${job.id}`}
                        className={buttonVariants({ variant: "outline", size: "sm", className: "gap-1" })}
                      >
                        <ScrollText className="size-3.5" />
                        View log
                      </Link>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="border-border/50 bg-card/50 ring-1 ring-border/30">
        <CardHeader>
          <CardTitle>Deployments</CardTitle>
          <CardDescription>Each row is one version. Host port is what you open in the browser for that slot.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto px-0">
          <Table>
            <TableHeader>
              <TableRow className="border-border/50 hover:bg-transparent">
                <TableHead className="pl-6">Ver</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Slot</TableHead>
                <TableHead>Host port</TableHead>
                <TableHead>App port</TableHead>
                <TableHead>Container</TableHead>
                <TableHead className="pr-6">When</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deployments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                    No deployments yet. Run Deploy above.
                  </TableCell>
                </TableRow>
              ) : (
                deployments.map((d) => {
                  const hp = hostPortForSlot(project, d.color);
                  const u = publicServiceUrl(hp);
                  return (
                    <TableRow key={d.id} className="border-border/40">
                      <TableCell className="pl-6 font-mono">v{d.version}</TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <StatusBadge status={d.status} />
                          {d.errorMessage ? (
                            <span className="max-w-[200px] truncate text-xs text-red-400" title={d.errorMessage ?? ""}>
                              {d.errorMessage}
                            </span>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell>
                        <SlotBadge color={d.color} />
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        <a href={u} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                          {hp}
                        </a>
                      </TableCell>
                      <TableCell className="font-mono text-sm tabular-nums">{project.appPort}</TableCell>
                      <TableCell className="max-w-[180px] truncate font-mono text-xs text-muted-foreground">{d.containerName}</TableCell>
                      <TableCell className="pr-6 text-sm text-muted-foreground">{new Date(d.createdAt).toLocaleString()}</TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Separator className="opacity-40" />
      <Link to="/" className={buttonVariants({ variant: "ghost", size: "sm", className: "text-muted-foreground" })}>
        ← Back to overview
      </Link>
    </div>
  );
}
