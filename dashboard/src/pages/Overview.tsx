import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Activity, AlertCircle, FolderKanban, Loader2, Plus, ScrollText } from "lucide-react";
import {
  getAllDeployments,
  getProjects,
  listProjectJobs,
  triggerDeploy,
  type Deployment,
  type JobRecord,
  type Project,
} from "@/lib/api";
import { Button, buttonVariants } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/StatusBadge";
import { SlotBadge } from "@/components/SlotBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useLaunchCreateProject } from "@/create-project-launch";
import { getDisplayDeployment, hostPortForSlot, publicServiceUrl } from "@/lib/deployment-display";

function projectStatus(projectId: string, deployments: Deployment[]): string {
  const mine = deployments.filter((d) => d.projectId === projectId);
  const active = mine.find((d) => d.status === "ACTIVE");
  if (mine.some((d) => d.status === "DEPLOYING")) return "DEPLOYING";
  if (active) return "ACTIVE";
  const last = mine.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
  if (last?.status === "FAILED") return "FAILED";
  if (last?.status === "ROLLED_BACK") return "ROLLED_BACK";
  return "PENDING";
}

function lastDeployed(projectId: string, deployments: Deployment[]): string {
  const mine = deployments
    .filter((d) => d.projectId === projectId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const top = mine[0];
  if (!top) return "—";
  return new Date(top.createdAt).toLocaleString();
}

export function Overview() {
  const launchCreate = useLaunchCreateProject();
  const [projects, setProjects] = useState<Project[]>([]);
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [latestJobs, setLatestJobs] = useState<Record<string, JobRecord | undefined>>({});
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [p, d] = await Promise.all([getProjects(), getAllDeployments()]);
      setProjects(p.projects);
      setDeployments(d.deployments);

      const jobEntries = await Promise.all(
        p.projects.map(async (proj) => {
          try {
            const r = await listProjectJobs(proj.id, { limit: 1 });
            return [proj.id, r.jobs[0]] as const;
          } catch {
            return [proj.id, undefined] as const;
          }
        })
      );
      setLatestJobs(Object.fromEntries(jobEntries));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const stats = useMemo(() => {
    let running = 0;
    let failed = 0;
    let deploying = 0;
    for (const proj of projects) {
      const s = projectStatus(proj.id, deployments);
      if (s === "ACTIVE") running++;
      if (s === "FAILED") failed++;
      if (s === "DEPLOYING") deploying++;
    }
    return {
      total: projects.length,
      running,
      failed,
      deploying,
    };
  }, [projects, deployments]);

  const onDeploy = async (projectId: string) => {
    try {
      const r = await triggerDeploy(projectId);
      toast.success(`Deploy queued — job ${r.jobId.slice(0, 8)}…`);
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Deploy failed");
    }
  };

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="space-y-2">
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-4 w-full max-w-md" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-72 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1400px] space-y-8">
      <PageHeader
        title="Deployments"
        description="Blue/green slots, published host ports, and container app ports. Open a project for full history and job logs."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              to="/server"
              className={buttonVariants({ variant: "outline", size: "sm", className: "gap-1.5" })}
            >
              <Activity className="size-3.5" />
              Host metrics
            </Link>
            <Button onClick={launchCreate} className="gap-2 shadow-lg shadow-primary/10">
              <Plus className="size-4" />
              Add project
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Projects" value={stats.total} icon={FolderKanban} />
        <StatCard
          label="Live"
          value={stats.running}
          icon={Activity}
          valueClassName="text-emerald-400"
          iconClassName="text-emerald-400/80"
        />
        <StatCard
          label="Failed"
          value={stats.failed}
          icon={AlertCircle}
          valueClassName="text-red-400"
          iconClassName="text-red-400/80"
        />
        <StatCard
          label="In progress"
          value={stats.deploying}
          icon={Loader2}
          valueClassName="text-cyan-400"
          iconClassName="text-cyan-400/80"
        />
      </div>

      {projects.length === 0 ? (
        <Card className="border-dashed border-border/60 bg-card/40">
          <CardHeader className="text-center sm:text-left">
            <CardTitle>No projects yet</CardTitle>
            <CardDescription>
              Add a Git repository to deploy with blue/green rollouts and zero-downtime swaps.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center gap-4 pb-10 sm:flex-row sm:pb-8">
            <Button size="lg" onClick={launchCreate} className="gap-2">
              <Plus className="size-5" />
              Create your first project
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-border/50 bg-card/60 shadow-none ring-1 ring-border/30">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <div>
              <CardTitle>All projects</CardTitle>
              <CardDescription>
                <span className="font-mono text-xs text-muted-foreground/90">
                  Host port = nginx/Docker publish · App port = container internal (EXPOSE)
                </span>
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="overflow-x-auto px-0 pb-2">
            <Table>
              <TableHeader>
                <TableRow className="border-border/50 hover:bg-transparent">
                  <TableHead className="pl-6">Project</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Slot</TableHead>
                  <TableHead>Host URL</TableHead>
                  <TableHead className="whitespace-nowrap">App port</TableHead>
                  <TableHead>Last activity</TableHead>
                  <TableHead>Logs</TableHead>
                  <TableHead className="pr-6 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projects.map((p) => {
                  const row = getDisplayDeployment(p.id, deployments);
                  const st = projectStatus(p.id, deployments);
                  const job = latestJobs[p.id];
                  const hostPort = row ? hostPortForSlot(p, row.color) : null;
                  const hostUrl = hostPort != null ? publicServiceUrl(hostPort) : null;

                  return (
                    <TableRow key={p.id} className="border-border/40">
                      <TableCell className="pl-6">
                        <div className="font-medium">{p.name}</div>
                        <div className="mt-0.5 max-w-[220px] truncate font-mono text-xs text-muted-foreground">
                          {p.repoUrl}
                        </div>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={st} />
                      </TableCell>
                      <TableCell>{row ? <SlotBadge color={row.color} /> : <span className="text-muted-foreground">—</span>}</TableCell>
                      <TableCell className="max-w-[200px]">
                        {hostUrl ? (
                          <a
                            href={hostUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="break-all font-mono text-xs text-primary underline-offset-2 hover:underline"
                          >
                            {hostUrl.replace(/^https?:\/\//, "")}
                          </a>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-sm tabular-nums">{row ? p.appPort : "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{lastDeployed(p.id, deployments)}</TableCell>
                      <TableCell>
                        {job ? (
                          <Link
                            to={`/projects/${p.id}/deploy/${job.id}`}
                            className={buttonVariants({ variant: "ghost", size: "sm", className: "gap-1 px-2 text-xs" })}
                          >
                            <ScrollText className="size-3.5" />
                            {job.status}
                          </Link>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="pr-6 text-right">
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="secondary" onClick={() => void onDeploy(p.id)}>
                            Deploy
                          </Button>
                          <Link to={`/projects/${p.id}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                            Detail
                          </Link>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
