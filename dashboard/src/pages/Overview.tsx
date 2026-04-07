import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Activity,
  AlertCircle,
  ArrowRight,
  Clock,
  ExternalLink,
  FolderKanban,
  GitBranch,
  Globe,
  Loader2,
  Plus,
  Rocket,
  ScrollText,
} from "lucide-react";
import {
  getAllDeployments,
  getProjects,
  listAllJobs,
  listProjectJobs,
  triggerDeploy,
  type Deployment,
  type JobRecord,
  type Project,
} from "@/lib/api";
import { Button, buttonVariants } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { SlotBadge } from "@/components/SlotBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { StatCard } from "@/components/StatCard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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

function timeAgo(date: string): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function Overview() {
  const launchCreate = useLaunchCreateProject();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [latestJobs, setLatestJobs] = useState<Record<string, JobRecord | undefined>>({});
  const [recentJobs, setRecentJobs] = useState<JobRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [p, d, allJobs] = await Promise.all([
        getProjects(),
        getAllDeployments(),
        listAllJobs({ limit: 5 }),
      ]);
      setProjects(p.projects);
      setDeployments(d.deployments);
      setRecentJobs(allJobs.jobs);

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
    return { total: projects.length, running, failed, deploying };
  }, [projects, deployments]);

  const onDeploy = async (projectId: string) => {
    try {
      const r = await triggerDeploy(projectId);
      toast.success(`Deploy queued — job ${r.jobId.slice(0, 8)}…`);
      navigate(`/projects/${projectId}/deploy/${r.jobId}`);
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
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-52 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Overview</h1>
          <p className="text-sm text-muted-foreground">
            Zero-downtime deployments with blue/green traffic switching
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/activity"
            className={buttonVariants({ variant: "outline", size: "sm", className: "gap-1.5" })}
          >
            <ScrollText className="size-3.5" />
            Activity
          </Link>
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
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total projects" value={stats.total} icon={FolderKanban} />
        <StatCard
          label="Live"
          value={stats.running}
          icon={Globe}
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
          label="Deploying"
          value={stats.deploying}
          icon={Loader2}
          valueClassName="text-cyan-400"
          iconClassName="text-cyan-400/80 animate-spin"
        />
      </div>

      {/* Empty state */}
      {projects.length === 0 ? (
        <Card className="border-dashed border-border/60 bg-card/40">
          <CardContent className="flex flex-col items-center justify-center gap-6 py-16">
            <div className="rounded-2xl border border-border/50 bg-muted/20 p-6">
              <Rocket className="size-10 text-muted-foreground" />
            </div>
            <div className="space-y-2 text-center">
              <h3 className="text-lg font-semibold">No projects yet</h3>
              <p className="max-w-sm text-sm text-muted-foreground">
                Connect a Git repository to deploy with blue/green rollouts and automatic zero-downtime swaps.
              </p>
            </div>
            <Button size="lg" onClick={launchCreate} className="gap-2">
              <Plus className="size-5" />
              Create your first project
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {/* Project cards */}
          <div>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold tracking-tight">Projects</h2>
              <span className="text-xs text-muted-foreground">{projects.length} total</span>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {projects.map((p) => {
                const row = getDisplayDeployment(p.id, deployments);
                const st = projectStatus(p.id, deployments);
                const job = latestJobs[p.id];
                const hostPort = row ? hostPortForSlot(p, row.color) : null;
                const hostUrl = hostPort != null ? publicServiceUrl(hostPort) : null;
                const lastDeploy = deployments
                  .filter((d) => d.projectId === p.id)
                  .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

                return (
                  <Card
                    key={p.id}
                    className="group relative border-border/50 bg-card/60 shadow-none ring-1 ring-border/30 transition-all hover:ring-primary/30 hover:shadow-md hover:shadow-primary/5"
                  >
                    <Link to={`/projects/${p.id}`} className="absolute inset-0 z-10" />
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <CardTitle className="truncate text-base font-semibold group-hover:text-primary transition-colors">
                            {p.name}
                          </CardTitle>
                          <CardDescription className="mt-1 flex items-center gap-1.5 truncate font-mono text-xs">
                            <GitBranch className="size-3 shrink-0" />
                            {p.branch}
                          </CardDescription>
                        </div>
                        <StatusBadge status={st} />
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3 pb-3">
                      {/* Repo */}
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="max-w-full truncate font-mono">{p.repoUrl.replace(/^https?:\/\/(www\.)?/, "")}</span>
                      </div>

                      {/* URL + slot */}
                      <div className="flex items-center gap-2">
                        {row && <SlotBadge color={row.color} />}
                        {hostUrl ? (
                          <a
                            href={hostUrl}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="relative z-20 flex items-center gap-1 truncate font-mono text-xs text-primary underline-offset-2 hover:underline"
                          >
                            {hostUrl.replace(/^https?:\/\//, "")}
                            <ExternalLink className="size-3 shrink-0 opacity-50" />
                          </a>
                        ) : (
                          <span className="text-xs text-muted-foreground/50">Not deployed</span>
                        )}
                      </div>

                      {/* Meta row */}
                      <div className="flex items-center gap-4 border-t border-border/30 pt-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <span className="font-mono tabular-nums">:{p.appPort}</span>
                        </span>
                        {lastDeploy && (
                          <span className="flex items-center gap-1">
                            <Clock className="size-3" />
                            {timeAgo(lastDeploy.createdAt)}
                          </span>
                        )}
                        <div className="ml-auto flex items-center gap-1.5">
                          {job && (
                            <Link
                              to={`/projects/${p.id}/deploy/${job.id}`}
                              onClick={(e) => e.stopPropagation()}
                              className="relative z-20"
                            >
                              <Badge variant={job.status === "FAILED" ? "destructive" : "secondary"} className="font-mono text-[10px]">
                                {job.status}
                              </Badge>
                            </Link>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="relative z-20 h-7 gap-1 px-2 text-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              void onDeploy(p.id);
                            }}
                          >
                            <Rocket className="size-3" />
                            Deploy
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}

              {/* Add project card */}
              <Card
                className="flex cursor-pointer items-center justify-center border-dashed border-border/40 bg-card/20 shadow-none ring-1 ring-border/20 transition-all hover:ring-primary/20 hover:bg-card/40 min-h-[180px]"
                onClick={launchCreate}
              >
                <div className="flex flex-col items-center gap-3 text-muted-foreground">
                  <div className="rounded-xl border border-border/40 bg-muted/20 p-3">
                    <Plus className="size-6" />
                  </div>
                  <span className="text-sm font-medium">New project</span>
                </div>
              </Card>
            </div>
          </div>

          {/* Recent activity */}
          {recentJobs.length > 0 && (
            <Card className="border-border/50 bg-card/50 shadow-none ring-1 ring-border/25">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                <div>
                  <CardTitle className="text-base">Recent activity</CardTitle>
                  <CardDescription>Latest deploy and rollback jobs</CardDescription>
                </div>
                <Link to="/activity" className={buttonVariants({ variant: "ghost", size: "sm", className: "gap-1 text-xs" })}>
                  View all
                  <ArrowRight className="size-3" />
                </Link>
              </CardHeader>
              <CardContent className="px-0 pb-2">
                <div className="divide-y divide-border/30">
                  {recentJobs.map((job) => {
                    const badgeVar =
                      job.status === "COMPLETE"
                        ? ("default" as const)
                        : job.status === "FAILED" || job.status === "CANCELLED"
                          ? ("destructive" as const)
                          : ("secondary" as const);

                    return (
                      <Link
                        key={job.id}
                        to={`/projects/${job.projectId}/deploy/${job.id}`}
                        className="flex items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-muted/30"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`size-2 shrink-0 rounded-full ${
                            job.status === "COMPLETE"
                              ? "bg-emerald-500"
                              : job.status === "FAILED"
                                ? "bg-red-500"
                                : job.status === "RUNNING"
                                  ? "bg-cyan-500 animate-pulse"
                                  : "bg-amber-500"
                          }`} />
                          <div className="min-w-0">
                            <span className="text-sm font-medium">{job.project?.name ?? "Unknown"}</span>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span className="font-mono">{job.type}</span>
                              <span>·</span>
                              <span>{timeAgo(job.createdAt)}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={badgeVar} className="font-mono text-[10px]">
                            {job.status}
                          </Badge>
                          <ArrowRight className="size-3.5 text-muted-foreground/50" />
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
