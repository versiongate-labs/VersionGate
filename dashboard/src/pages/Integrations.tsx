import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Cable, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ApiError, getGithubIntegrationStatus, type GithubIntegrationStatus } from "@/lib/api";
import { Separator } from "@/components/ui/separator";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const MANAGE_APP_HREF = "https://github.com/apps/VersionGate-App/installations";
const INSTALL_HREF = "/api/auth/github/install";

export function Integrations() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<GithubIntegrationStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const s = await getGithubIntegrationStatus();
        if (!cancelled) setStatus(s);
      } catch (e) {
        if (!cancelled) {
          if (e instanceof ApiError && e.status === 503) {
            setError(
              "GitHub App is not configured on this server. Set GITHUB_APP_ID and GITHUB_APP_PRIVATE_KEY on the engine."
            );
          } else {
            setError(e instanceof ApiError ? e.message : "Failed to load GitHub status");
          }
          setStatus(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const githubQuery = useMemo(() => {
    const g = searchParams.get("github");
    return g ? g.trim().toLowerCase() : null;
  }, [searchParams]);

  useEffect(() => {
    if (!githubQuery) return;
    const messages: Record<string, { type: "success" | "error"; text: string }> = {
      connected: { type: "success", text: "GitHub App connected successfully." },
      auth_required: {
        type: "error",
        text: "Could not link the installation — sign in to VersionGate and try again.",
      },
      config: { type: "error", text: "GitHub App is not configured on this server." },
      missing_installation: { type: "error", text: "Missing installation from GitHub redirect." },
      bad_installation: { type: "error", text: "Could not read installation details from GitHub." },
    };
    const m = messages[githubQuery];
    if (m) {
      if (m.type === "success") toast.success(m.text);
      else toast.error(m.text);
    }
    setSearchParams({}, { replace: true });
  }, [githubQuery, setSearchParams]);

  const connected = status?.connected && status.installation;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
      <PageHeader
        title="Integrations"
        description="Connect external services to streamline project setup and automation."
      />

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Cable className="size-5 opacity-80" aria-hidden />
                GitHub
              </CardTitle>
              <CardDescription>
                Install the VersionGate GitHub App to list repositories and deploy on push.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {loading ? (
            <div className="flex items-center gap-4">
              <Skeleton className="size-14 rounded-full" />
              <div className="grid flex-1 gap-2">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-4 w-72" />
              </div>
            </div>
          ) : error ? (
            <div className="rounded-lg border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {error}
              {error.toLowerCase().includes("not configured") ? (
                <p className="mt-2 text-muted-foreground">
                  Ask your operator to set <code className="rounded bg-muted px-1 font-mono text-xs">GITHUB_APP_ID</code>{" "}
                  and <code className="rounded bg-muted px-1 font-mono text-xs">GITHUB_APP_PRIVATE_KEY</code>.
                </p>
              ) : null}
            </div>
          ) : connected && status.installation ? (
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-4">
                <Avatar size="lg" className="size-14 border border-border">
                  {status.installation.avatarUrl ? (
                    <AvatarImage src={status.installation.avatarUrl} alt="" />
                  ) : null}
                  <AvatarFallback className="bg-muted text-lg font-semibold">
                    {status.installation.githubAccountLogin.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-mono text-base font-semibold text-foreground">
                      {status.installation.githubAccountLogin}
                    </p>
                    <Badge className="font-normal">Connected</Badge>
                    <Badge variant="outline" className="font-normal capitalize">
                      {status.installation.githubAccountType}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Installation ID <span className="font-mono">{status.installation.installationId}</span>
                  </p>
                  {status.installations.length > 1 ? (
                    <p className="text-xs text-muted-foreground">
                      + {status.installations.length - 1} other installation
                      {status.installations.length > 2 ? "s" : ""} linked to your account
                    </p>
                  ) : null}
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <a
                  href={MANAGE_APP_HREF}
                  target="_blank"
                  rel="noreferrer"
                  className={cn(buttonVariants({ variant: "outline", size: "sm" }), "inline-flex gap-1.5")}
                >
                  <ExternalLink className="size-3.5" />
                  Manage on GitHub
                </a>
                <a href={INSTALL_HREF} className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}>
                  Add another org
                </a>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                Connect your GitHub account or organization so VersionGate can read repositories you grant access to.
              </p>
              <a href={INSTALL_HREF} className={cn(buttonVariants())}>
                Connect GitHub
              </a>
            </div>
          )}

          {!loading && !error && status?.connected && status.installations.length > 1 ? (
            <>
              <Separator />
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  All installations
                </p>
                <ul className="grid gap-2 text-sm">
                  {status.installations.map((i) => (
                    <li
                      key={i.installationId}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-muted/30 px-3 py-2"
                    >
                      <span className="font-mono font-medium">{i.githubAccountLogin}</span>
                      <span className="text-xs capitalize text-muted-foreground">{i.githubAccountType}</span>
                      <span className="font-mono text-xs text-muted-foreground">{i.installationId}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>

      <p className="text-center text-xs text-muted-foreground">
        After connecting, use <Link className="text-primary underline-offset-2 hover:underline" to="/projects">New project</Link>{" "}
        to pick a repository and branch.
      </p>
    </div>
  );
}
