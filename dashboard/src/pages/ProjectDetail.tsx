import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  getDeployments,
  getProject,
  rollback,
  triggerDeploy,
  type Deployment,
  type Project,
} from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/StatusBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Separator } from "@/components/ui/separator";

export function ProjectDetail() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [p, d] = await Promise.all([getProject(id), getDeployments(id)]);
      setProject(p.project);
      setDeployments(d.deployments);
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

  const onDeploy = async () => {
    if (!id) return;
    try {
      const r = await triggerDeploy(id);
      toast.success(`Deploy queued — job ${r.jobId}`);
      navigate(`/projects/${id}/deploy/${r.jobId}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Deploy failed");
    }
  };

  const onRollback = async () => {
    if (!id) return;
    try {
      const r = await rollback(id);
      toast.success(`Rollback queued — job ${r.jobId}`);
      navigate(`/projects/${id}/deploy/${r.jobId}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Rollback failed");
    }
  };

  if (loading || !project) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{project.name}</h1>
          <p className="text-muted-foreground text-sm mt-1">{project.repoUrl}</p>
          <p className="text-sm mt-2">
            Branch: <span className="font-mono">{project.branch}</span>
          </p>
          <div className="mt-2">
            <StatusBadge status={displayStatus} />
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => void onDeploy()}>Deploy</Button>
          <Button variant="outline" onClick={() => void onRollback()}>
            Rollback
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Environment chain</CardTitle>
          <CardDescription>Placeholder for dev → staging → prod routing.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span className="rounded-md border px-3 py-1">dev</span>
          <span>→</span>
          <span className="rounded-md border px-3 py-1">staging</span>
          <span>→</span>
          <span className="rounded-md border px-3 py-1">prod</span>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Deployment history</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Version</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Container</TableHead>
                <TableHead>Port</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deployments.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="font-mono">v{d.version}</TableCell>
                  <TableCell>
                    <StatusBadge status={d.status} />
                  </TableCell>
                  <TableCell className="font-mono text-xs">{d.containerName}</TableCell>
                  <TableCell>{d.port}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {new Date(d.createdAt).toLocaleString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Separator />
      <Link to="/" className={buttonVariants({ variant: "link", size: "sm" })}>
        ← Back to overview
      </Link>
    </div>
  );
}
