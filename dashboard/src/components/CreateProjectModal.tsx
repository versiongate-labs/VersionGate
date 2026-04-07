import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { createProject } from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

const NAME_PATTERN = /^[a-z0-9-]+$/;

const ROOT_PRESETS = [
  { label: "Repository root", value: "." },
  { label: "apps/web", value: "apps/web" },
  { label: "frontend", value: "frontend" },
  { label: "packages/app", value: "packages/app" },
] as const;

export function CreateProjectModal({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
}) {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState("");
  const [repoUrl, setRepoUrl] = useState("");
  const [branch, setBranch] = useState("main");
  const [buildContext, setBuildContext] = useState(".");
  const [appPort, setAppPort] = useState("3000");
  const [healthPath, setHealthPath] = useState("/health");

  const reset = () => {
    setName("");
    setRepoUrl("");
    setBranch("main");
    setBuildContext(".");
    setAppPort("3000");
    setHealthPath("/health");
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim().toLowerCase();
    if (!NAME_PATTERN.test(trimmed)) {
      toast.error("Name must be lowercase letters, numbers, and hyphens only (e.g. my-app).");
      return;
    }
    const port = Number.parseInt(appPort, 10);
    if (!Number.isFinite(port) || port < 1 || port > 65535) {
      toast.error("App port must be between 1 and 65535.");
      return;
    }
    setSubmitting(true);
    try {
      const { project } = await createProject({
        name: trimmed,
        repoUrl: repoUrl.trim(),
        branch: branch.trim() || "main",
        buildContext: buildContext.trim() || ".",
        appPort: port,
        healthPath: healthPath.trim() || "/health",
      });
      toast.success("Project created");
      handleOpenChange(false);
      onCreated?.();
      navigate(`/projects/${project.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create project");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New project</DialogTitle>
          <DialogDescription>
            Point at your Git repo, then choose the directory that contains your app (like Vercel &quot;Root
            Directory&quot;). Blue/green host ports are assigned automatically.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => void onSubmit(e)} className="grid gap-4">
          <div className="grid gap-1.5">
            <label htmlFor="cp-name" className="text-sm font-medium">
              Project name
            </label>
            <Input
              id="cp-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="my-app"
              autoComplete="off"
              required
            />
            <p className="text-xs text-muted-foreground">Lowercase letters, numbers, hyphens only.</p>
          </div>
          <div className="grid gap-1.5">
            <label htmlFor="cp-repo" className="text-sm font-medium">
              Git repository URL
            </label>
            <Input
              id="cp-repo"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              placeholder="https://github.com/org/repo.git"
              autoComplete="off"
              required
            />
          </div>
          <div className="grid gap-1.5">
            <label htmlFor="cp-branch" className="text-sm font-medium">
              Production branch
            </label>
            <Input id="cp-branch" value={branch} onChange={(e) => setBranch(e.target.value)} placeholder="main" />
          </div>

          <div className="grid gap-2">
            <label htmlFor="cp-ctx" className="text-sm font-medium">
              Root directory
            </label>
            <p className="text-xs text-muted-foreground">
              Path from repo root to the folder Docker should build (where your Dockerfile or app lives).
            </p>
            <div className="flex flex-wrap gap-2">
              {ROOT_PRESETS.map((p) => (
                <Button
                  key={p.value}
                  type="button"
                  size="sm"
                  variant={buildContext === p.value ? "default" : "outline"}
                  className="h-8 text-xs"
                  onClick={() => setBuildContext(p.value)}
                >
                  {p.label}
                </Button>
              ))}
            </div>
            <Input
              id="cp-ctx"
              value={buildContext}
              onChange={(e) => setBuildContext(e.target.value)}
              placeholder="."
              className="font-mono text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <label htmlFor="cp-port" className="text-sm font-medium">
                Container app port
              </label>
              <Input
                id="cp-port"
                inputMode="numeric"
                value={appPort}
                onChange={(e) => setAppPort(e.target.value)}
                placeholder="3000"
              />
              <p className="text-xs text-muted-foreground">EXPOSE / listen port inside the image.</p>
            </div>
            <div className="grid gap-1.5">
              <label htmlFor="cp-health" className="text-sm font-medium">
                Health check path
              </label>
              <Input id="cp-health" value={healthPath} onChange={(e) => setHealthPath(e.target.value)} placeholder="/health" />
            </div>
          </div>
          <DialogFooter className="gap-2 pt-2 sm:justify-end">
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Creating…" : "Create project"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
