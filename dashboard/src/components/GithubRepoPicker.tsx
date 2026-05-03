import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ExternalLink, GitBranch, Lock, Search } from "lucide-react";
import { ApiError, getGithubRepos, type GithubRepoRow } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

function formatUpdated(iso: string | null): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return "—";
  }
}

export function GithubRepoPicker({
  installationId,
  selectedFullName,
  onRepoSelect,
}: {
  installationId: string | null;
  selectedFullName: string | null;
  onRepoSelect: (repo: GithubRepoRow) => void;
}) {
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [repos, setRepos] = useState<GithubRepoRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!installationId) {
      setRepos([]);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    void getGithubRepos(installationId)
      .then((r) => {
        if (!cancelled) setRepos(r.repositories);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        const msg =
          e instanceof ApiError
            ? e.status === 400 || e.status === 401
              ? "GitHub is not connected or the installation is invalid. Reconnect on Integrations."
              : e.message
            : "Could not load repositories.";
        setError(msg);
        setRepos([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [installationId]);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return repos;
    return repos.filter(
      (r) =>
        r.fullName.toLowerCase().includes(q) ||
        r.name.toLowerCase().includes(q) ||
        r.owner.toLowerCase().includes(q)
    );
  }, [repos, filter]);

  if (!installationId) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
        Choose a GitHub installation above (Integrations) or connect GitHub first.
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Search by repository name…"
          className="pl-9"
          disabled={loading}
          aria-label="Filter repositories"
        />
      </div>

      {loading ? (
        <div className="grid gap-2 rounded-lg border border-border bg-card p-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-md" />
          ))}
        </div>
      ) : error ? (
        <div
          className="rounded-lg border border-amber-200/90 bg-amber-50/90 px-3 py-3 text-sm text-amber-950"
          role="alert"
        >
          <p className="font-medium">Could not load repositories</p>
          <p className="mt-1 text-amber-900/90">{error}</p>
          <Link
            to="/dashboard/integrations"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "mt-3 inline-flex")}
          >
            Open Integrations
          </Link>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
          {repos.length === 0 ? "No repositories returned for this installation." : "No matches for your search."}
        </div>
      ) : (
        <ul className="max-h-72 space-y-1 overflow-y-auto rounded-lg border border-border bg-card p-1.5">
          {filtered.map((r) => {
            const active = selectedFullName === r.fullName;
            return (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => onRepoSelect(r)}
                  className={cn(
                    "flex w-full flex-col gap-1 rounded-md px-2.5 py-2 text-left text-sm transition-colors",
                    active
                      ? "bg-primary/10 ring-1 ring-primary/30"
                      : "hover:bg-muted/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  )}
                >
                  <div className="flex min-w-0 items-center justify-between gap-2">
                    <span className="truncate font-medium text-foreground">{r.fullName}</span>
                    <div className="flex shrink-0 items-center gap-1">
                      <Badge variant={r.private ? "secondary" : "outline"} className="text-[10px] font-normal">
                        {r.private ? (
                          <>
                            <Lock className="mr-0.5 size-3" aria-hidden />
                            Private
                          </>
                        ) : (
                          "Public"
                        )}
                      </Badge>
                      <a
                        href={r.htmlUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded p-0.5 text-muted-foreground hover:text-foreground"
                        title="Open on GitHub"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ExternalLink className="size-3.5" aria-hidden />
                      </a>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                    {r.language ? <span>{r.language}</span> : null}
                    <span className="inline-flex items-center gap-1">
                      <GitBranch className="size-3 opacity-70" aria-hidden />
                      {r.defaultBranch ?? "—"}
                    </span>
                    <span>Updated {formatUpdated(r.updatedAt ?? r.pushedAt)}</span>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
