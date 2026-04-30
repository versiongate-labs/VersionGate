import { execSync } from "child_process";
import { projectRoot } from "./paths";
import { logger } from "./logger";

export type PrismaSchemaSyncMode = "migrate" | "push";

const DEFAULT_TIMEOUT_MS = 120_000;

type ExecSyncError = Error & { status?: number; stderr?: string; stdout?: string };

function execSyncWithLogs(command: string, opts: { cwd: string; env: NodeJS.ProcessEnv; timeout: number }): void {
  try {
    execSync(command, {
      cwd: opts.cwd,
      env: opts.env,
      timeout: opts.timeout,
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (e: unknown) {
    const x = e as ExecSyncError;
    if (typeof x.stderr === "string" && x.stderr.trim()) {
      logger.error({ stderr: x.stderr.trimEnd().slice(-12_000) }, `${command} stderr`);
    }
    if (typeof x.stdout === "string" && x.stdout.trim()) {
      logger.error({ stdout: x.stdout.trimEnd().slice(-8000) }, `${command} stdout`);
    }
    throw e;
  }
}

/** Neon pooled hosts include `-pooler.`; Prisma migrate needs a session-capable host for `pg_advisory_lock`. */
const NEON_POOLER_MARKER = "-pooler.";

/**
 * If `DATABASE_URL` points at a Neon pooler host, derive the usual direct hostname by dropping `-pooler.`.
 * Returns null when not applicable or parse fails. Explicit `DIRECT_DATABASE_URL` always wins (see {@link envForMigrateDeploy}).
 */
export function tryInferNeonDirectDatabaseUrl(poolerDatabaseUrl: string): string | null {
  try {
    const trimmed = poolerDatabaseUrl.trim();
    if (!trimmed) return null;
    const usePostgresqlScheme = /^postgresql:/i.test(trimmed);
    const normalized = trimmed.replace(/^postgresql:/i, "postgres:");
    if (!/^postgres:/i.test(normalized)) return null;
    const u = new URL(normalized);
    const host = u.hostname;
    if (!host.toLowerCase().includes("neon.tech")) return null;
    const p = host.indexOf(NEON_POOLER_MARKER);
    if (p === -1) return null;
    u.hostname = `${host.slice(0, p)}.${host.slice(p + NEON_POOLER_MARKER.length)}`;
    let out = u.toString();
    if (usePostgresqlScheme) out = out.replace(/^postgres:/i, "postgresql:");
    return out;
  } catch {
    return null;
  }
}

/** Prisma Migrate needs a real DB session for advisory locks — Neon pooler URLs often hit P1002. */
function envForMigrateDeploy(base: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const explicitDirect = base.DIRECT_DATABASE_URL?.trim();
  if (explicitDirect) {
    return { ...base, DATABASE_URL: explicitDirect };
  }
  const pooler = base.DATABASE_URL?.trim();
  if (!pooler) return base;
  const inferred = tryInferNeonDirectDatabaseUrl(pooler);
  if (!inferred) return base;
  return { ...base, DATABASE_URL: inferred };
}

/**
 * Applies Prisma schema changes: prefer `migrate deploy` (versioned migrations in repo),
 * with optional fallback to `db push` for databases that predate migration history.
 */
export function runPrismaSchemaSync(options: {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  mode?: PrismaSchemaSyncMode;
  timeoutMs?: number;
  /** When true, do not fall back to db push if migrate deploy fails */
  strictMigrate?: boolean;
}): void {
  const cwd = options.cwd ?? projectRoot;
  const env = options.env ?? process.env;
  const mode = options.mode ?? "migrate";
  const timeout = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const strict = options.strictMigrate ?? false;

  if (mode === "push") {
    logger.info("Database schema sync: prisma db push (PRISMA_SCHEMA_SYNC=push)");
    execSyncWithLogs("bunx prisma db push --accept-data-loss", {
      cwd,
      env,
      timeout,
    });
    return;
  }

  const migrateEnv = envForMigrateDeploy(env);
  if (env.DIRECT_DATABASE_URL?.trim()) {
    logger.info("prisma migrate deploy: using DIRECT_DATABASE_URL as DATABASE_URL (avoids pooler advisory-lock timeouts)");
  } else if (migrateEnv.DATABASE_URL !== env.DATABASE_URL) {
    logger.info(
      "prisma migrate deploy: inferred Neon direct URL from pooler DATABASE_URL (dropped `-pooler.` host label). Set DIRECT_DATABASE_URL in .env if your project uses a different direct endpoint."
    );
  }

  try {
    execSyncWithLogs("bunx prisma migrate deploy", {
      cwd,
      env: migrateEnv,
      timeout,
    });
    logger.info("Database migrations applied (prisma migrate deploy)");
  } catch (firstErr: unknown) {
    const msg = firstErr instanceof Error ? firstErr.message : String(firstErr);
    if (strict) {
      throw firstErr;
    }
    // P3005 = DB never baselined for Migrate; push would emit wrong one-shot DDL (e.g. NOT NULL
    // without the backfill steps in versioned migrations). Do not fall back to db push.
    // P1001/P1002 = connectivity / advisory lock (Neon pooler) — push is the wrong recovery; use DIRECT_DATABASE_URL.
    const noPushFallback =
      /\bP3005\b/i.test(msg) ||
      /\bP3009\b/i.test(msg) ||
      /\bP1001\b/i.test(msg) ||
      /\bP1002\b/i.test(msg) ||
      /baseline an existing production database/i.test(msg) ||
      /advisory lock/i.test(msg);
    if (noPushFallback) {
      logger.error(
        { err: msg },
        "prisma migrate deploy failed (baseline / migration history / DB reachability / advisory lock). Not using db push fallback — see docs/database-migrations.md (Neon: set DIRECT_DATABASE_URL or use a `-pooler.` pooler URL for automatic direct-host inference)."
      );
      throw firstErr;
    }
    logger.warn(
      { err: msg },
      "prisma migrate deploy failed — falling back to prisma db push (legacy or drifted database)"
    );
    execSyncWithLogs("bunx prisma db push --accept-data-loss", {
      cwd,
      env,
      timeout,
    });
    logger.warn("Database schema synced via prisma db push fallback");
  }
}
