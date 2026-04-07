import type { Deployment, Project } from "@/lib/api";

export type DeploymentColor = "BLUE" | "GREEN";

export function isDeploymentColor(c: string): c is DeploymentColor {
  return c === "BLUE" || c === "GREEN";
}

/** Published host port for blue/green (maps to Docker publish). */
export function hostPortForSlot(project: Project, color: string): number {
  if (color === "GREEN") return project.basePort + 1;
  return project.basePort;
}

export function slotLabel(color: string): string {
  if (color === "GREEN") return "Green";
  if (color === "BLUE") return "Blue";
  return color;
}

export function publicServiceUrl(port: number, hostname?: string): string {
  const host = hostname ?? (typeof window !== "undefined" ? window.location.hostname : "localhost");
  const proto = typeof window !== "undefined" && window.location.protocol === "https:" ? "https" : "http";
  if (port === 80 && proto === "http") return `${proto}://${host}`;
  if (port === 443 && proto === "https") return `${proto}://${host}`;
  return `${proto}://${host}:${port}`;
}

export function getDeployingDeployment(
  projectId: string,
  deployments: Deployment[]
): Deployment | undefined {
  return deployments.find((d) => d.projectId === projectId && d.status === "DEPLOYING");
}

export function getActiveDeployment(
  projectId: string,
  deployments: Deployment[]
): Deployment | undefined {
  return deployments.find((d) => d.projectId === projectId && d.status === "ACTIVE");
}

/** Prefer in-flight deploy row for slot/port; else live active. */
export function getDisplayDeployment(
  projectId: string,
  deployments: Deployment[]
): Deployment | undefined {
  return (
    getDeployingDeployment(projectId, deployments) ??
    getActiveDeployment(projectId, deployments) ??
    undefined
  );
}
