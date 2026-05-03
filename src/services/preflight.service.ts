import { constants, existsSync } from "fs";
import { access } from "fs/promises";
import { promises as dns } from "dns";
import { config } from "../config/env";
import { execFileAsync } from "../utils/exec";
import { findCertbotExecutablePath } from "../utils/certbot-path";
import { isValidHostname, isValidIpv4Address } from "../utils/domain-validation";

export type PreflightSeverity = "required" | "recommended" | "informational";

export interface PreflightCheck {
  id: string;
  label: string;
  severity: PreflightSeverity;
  ok: boolean;
  message: string;
  detail?: string;
}

export interface PreflightReport {
  ok: boolean;
  checkedAt: string;
  checks: PreflightCheck[];
}

async function tryExec(
  cmd: string,
  args: string[],
  env?: NodeJS.ProcessEnv
): Promise<{ ok: true; out: string } | { ok: false; err: string }> {
  try {
    const { stdout, stderr } = await execFileAsync(cmd, args, env ? { env: { ...process.env, ...env } } : undefined);
    const out = `${stdout}${stderr}`.trim();
    return { ok: true, out };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, err: msg };
  }
}

function firstLine(s: string): string {
  const line = s.split("\n").find((l) => l.trim()) ?? s;
  return line.trim().slice(0, 200);
}

/**
 * Host compatibility checks for VersionGate (Bun, Docker, network, Git, etc.).
 * Safe to call without PostgreSQL — used by CLI and `GET /api/v1/system/preflight`.
 */
export async function runPreflightChecks(): Promise<PreflightReport> {
  const checks: PreflightCheck[] = [];
  const dockerBin = config.dockerBin;

  // ── Bun (this process) ─────────────────────────────────────────────────────
  const bunVer = process.versions.bun;
  checks.push({
    id: "bun",
    label: "Bun runtime",
    severity: "required",
    ok: Boolean(bunVer),
    message: bunVer ? `Bun ${bunVer}` : "Process is not running under Bun (start API/worker with `bun`)",
    detail: bunVer,
  });

  // ── Node (optional; some operators use node tooling alongside Bun) ─────────
  const node = await tryExec("node", ["--version"]);
  checks.push({
    id: "node",
    label: "Node.js CLI",
    severity: "recommended",
    ok: node.ok,
    message: node.ok ? firstLine(node.out) : "`node` not in PATH (optional if you only use Bun)",
    detail: node.ok ? firstLine(node.out) : undefined,
  });

  // ── Git (deploy clone/fetch) ───────────────────────────────────────────────
  const git = await tryExec("git", ["--version"]);
  checks.push({
    id: "git",
    label: "Git",
    severity: "required",
    ok: git.ok,
    message: git.ok ? firstLine(git.out) : "Git is required to clone and update repositories",
    detail: git.ok ? firstLine(git.out) : undefined,
  });

  // ── Docker CLI ─────────────────────────────────────────────────────────────
  const dockerClient = await tryExec(dockerBin, ["version", "--format", "{{.Client.Version}}"]);
  checks.push({
    id: "docker_cli",
    label: "Docker CLI",
    severity: "required",
    ok: dockerClient.ok,
    message: dockerClient.ok
      ? `Client ${dockerClient.out.trim()}`
      : `Cannot run Docker CLI (${dockerBin}). Set DOCKER_BIN or fix PATH (see ecosystem.config.cjs).`,
    detail: dockerClient.ok ? dockerClient.out.trim() : dockerClient.err,
  });

  // ── Docker daemon ────────────────────────────────────────────────────────────
  const dockerInfo = await tryExec(dockerBin, ["info", "--format", "{{.ServerVersion}}"]);
  checks.push({
    id: "docker_daemon",
    label: "Docker daemon",
    severity: "required",
    ok: dockerInfo.ok,
    message: dockerInfo.ok
      ? `Server ${dockerInfo.out.trim()}`
      : "Docker daemon not reachable (is `dockerd` running? user in `docker` group?)",
    detail: dockerInfo.ok ? dockerInfo.out.trim() : dockerInfo.err,
  });

  // ── Docker network (deployments attach containers here) ─────────────────────
  const netName = config.dockerNetwork;
  const dockerNet = await tryExec(dockerBin, ["network", "inspect", netName, "--format", "{{.Name}}"]);
  checks.push({
    id: "docker_network",
    label: `Docker network "${netName}"`,
    severity: "required",
    ok: dockerNet.ok,
    message: dockerNet.ok
      ? `Network ${dockerNet.out.trim()} exists`
      : `Create with: docker network create ${netName} (or set DOCKER_NETWORK in .env to an existing network)`,
    detail: dockerNet.ok ? dockerNet.out.trim() : dockerNet.err,
  });

  // ── Projects root writable ─────────────────────────────────────────────────
  let projectsOk = false;
  let projectsMsg = "";
  try {
    await access(config.projectsRootPath, constants.R_OK | constants.W_OK);
    projectsOk = true;
    projectsMsg = `Readable & writable: ${config.projectsRootPath}`;
  } catch {
    if (existsSync(config.projectsRootPath)) {
      projectsMsg = `Path exists but is not writable: ${config.projectsRootPath}`;
    } else {
      projectsMsg = `Path does not exist yet: ${config.projectsRootPath} (create it or set PROJECTS_ROOT_PATH)`;
    }
  }
  checks.push({
    id: "projects_root",
    label: "Projects directory",
    severity: "required",
    ok: projectsOk,
    message: projectsMsg,
    detail: config.projectsRootPath,
  });

  // ── PM2 (recommended for production) ──────────────────────────────────────
  const pm2 = await tryExec("pm2", ["--version"]);
  checks.push({
    id: "pm2",
    label: "PM2",
    severity: "recommended",
    ok: pm2.ok,
    message: pm2.ok ? `pm2 ${pm2.out.trim()}` : "`pm2` not in PATH (optional; use systemd or another supervisor)",
    detail: pm2.ok ? pm2.out.trim() : undefined,
  });

  // ── Nginx (traffic switching) ───────────────────────────────────────────────
  const nginx = await tryExec("nginx", ["-v"]);
  checks.push({
    id: "nginx",
    label: "Nginx",
    severity: "recommended",
    ok: nginx.ok,
    message: nginx.ok ? firstLine(nginx.out) : "`nginx` not in PATH (install for automatic upstream switching)",
    detail: nginx.ok ? firstLine(nginx.out) : undefined,
  });

  if (nginx.ok) {
    const nginxConfExists = existsSync(config.nginxConfigPath);
    checks.push({
      id: "nginx_config_path",
      label: "Nginx config path",
      severity: "informational",
      ok: nginxConfExists,
      message: nginxConfExists
        ? `File exists: ${config.nginxConfigPath}`
        : `Not found yet: ${config.nginxConfigPath} — use Settings → Write nginx config after setting PUBLIC_DOMAIN`,
      detail: config.nginxConfigPath,
    });
  }

  // ── Certbot + nginx plugin (Settings → Obtain SSL) ─────────────────────────
  const certbotBin = findCertbotExecutablePath();
  const certbotCmd = certbotBin ?? "certbot";
  const certbotVer = await tryExec(certbotCmd, ["--version"]);
  checks.push({
    id: "certbot",
    label: "Certbot (Let's Encrypt)",
    severity: "recommended",
    ok: certbotVer.ok,
    message: certbotVer.ok
      ? `${firstLine(certbotVer.out)}${certbotBin ? ` · ${certbotBin}` : ""}`
      : "Install certbot + python3-certbot-nginx (or snap certbot) for in-dashboard TLS; see docs/SETUP.md",
    detail: certbotVer.ok ? undefined : certbotVer.err,
  });

  let certbotNginxPluginOk = false;
  let certbotPluginsOut = "";
  if (certbotVer.ok) {
    const plugins = await tryExec(certbotCmd, ["plugins"]);
    certbotPluginsOut = plugins.ok ? plugins.out.slice(0, 600) : plugins.err;
    certbotNginxPluginOk = plugins.ok && /\bnginx\b/i.test(plugins.out);
  }
  checks.push({
    id: "certbot_nginx_plugin",
    label: "Certbot nginx plugin",
    severity: "recommended",
    ok: certbotVer.ok && certbotNginxPluginOk,
    message:
      !certbotVer.ok
        ? "Skipped — install certbot first"
        : certbotNginxPluginOk
          ? "`certbot --nginx` installer available"
          : "Install python3-certbot-nginx (Debian/Ubuntu) so Settings → Obtain SSL can use the nginx authenticator",
    detail: certbotPluginsOut || undefined,
  });

  // ── Public URL / TLS alignment (PUBLIC_DOMAIN from env this process loaded) ─
  const publicDomain = (process.env.PUBLIC_DOMAIN ?? "").trim().toLowerCase();
  const certbotEmail = (process.env.CERTBOT_EMAIL ?? "").trim();
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(certbotEmail);

  if (publicDomain && isValidHostname(publicDomain)) {
    try {
      const a = await dns.resolve4(publicDomain);
      checks.push({
        id: "public_domain_dns_a",
        label: `DNS A for ${publicDomain}`,
        severity: "recommended",
        ok: a.length > 0,
        message:
          a.length > 0
            ? `Resolved: ${a.join(", ")} (from this host — Let's Encrypt must reach this server on port 80)`
            : "No A records returned",
        detail: publicDomain,
      });
    } catch (e) {
      const err = e instanceof Error ? e.message : String(e);
      checks.push({
        id: "public_domain_dns_a",
        label: `DNS A for ${publicDomain}`,
        severity: "recommended",
        ok: false,
        message:
          "No A record from this host — subdomain or propagation issue; HTTP-01 validation will fail until DNS points here",
        detail: err.slice(0, 300),
      });
    }
  } else if (publicDomain && isValidIpv4Address(publicDomain)) {
    checks.push({
      id: "public_domain_dns_a",
      label: "PUBLIC_DOMAIN",
      severity: "informational",
      ok: true,
      message: `Using IPv4 ${publicDomain} — browser access OK; Let's Encrypt needs a DNS hostname instead`,
      detail: publicDomain,
    });
  } else {
    checks.push({
      id: "public_domain_dns_a",
      label: "PUBLIC_DOMAIN (public URL)",
      severity: "informational",
      ok: true,
      message: "Not set — configure Settings → Dashboard URL & hostname when exposing VersionGate on a domain",
    });
  }

  const wantsHttpsCookies =
    Boolean(publicDomain && isValidHostname(publicDomain)) && !isValidIpv4Address(publicDomain);
  checks.push({
    id: "certbot_email_env",
    label: "CERTBOT_EMAIL",
    severity: "recommended",
    ok: !wantsHttpsCookies || emailOk,
    message:
      wantsHttpsCookies && !emailOk
        ? "Set CERTBOT_EMAIL in .env (or in Settings) for non-interactive `certbot --nginx` contact"
        : emailOk
          ? "Let's Encrypt contact email is set"
          : "Optional until you use Obtain SSL with a hostname",
    detail: certbotEmail ? "[set]" : undefined,
  });

  checks.push({
    id: "cookie_secure_https",
    label: "COOKIE_SECURE (HTTPS sessions)",
    severity: "recommended",
    ok: !wantsHttpsCookies || config.cookieSecure,
    message: wantsHttpsCookies && !config.cookieSecure
      ? "Set COOKIE_SECURE=true when the dashboard is HTTPS-only so session cookies use the Secure flag"
      : config.cookieSecure
        ? "COOKIE_SECURE=true — session cookies are Secure (use with HTTPS reverse proxy)"
        : "COOKIE_SECURE unset/false — fine for HTTP or local access behind plain IP",
  });

  const requiredOk = checks.filter((c) => c.severity === "required").every((c) => c.ok);

  return {
    ok: requiredOk,
    checkedAt: new Date().toISOString(),
    checks,
  };
}
