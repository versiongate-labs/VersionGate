# AGENTS.md

## Cursor Cloud specific instructions

### Overview

VersionGate is a self-hosted zero-downtime Docker deployment engine with two main components:
- **Backend (Fastify API)** — runs on port 9090 (`bun --watch src/server.ts`)
- **Dashboard (React/Vite)** — runs on port 5173 (`cd dashboard && bun run dev`), proxies `/api` to the backend

### Prerequisites (already installed in the environment)

- **Bun** — runtime and package manager for both backend and dashboard
- **PostgreSQL 16** — local instance, database `versiongate`, user `versiongate`/`versiongate`
- **Docker** — required for the deployment pipeline (running via `dockerd` with `fuse-overlayfs` storage driver for nested container support)

### Running services

| Service | Command | Port |
|---------|---------|------|
| Backend API | `bun --watch src/server.ts` | 9090 |
| Dashboard dev | `cd dashboard && bun run dev` | 5173 |
| PostgreSQL | `sudo pg_ctlcluster 16 main start` | 5432 |
| Docker daemon | `sudo dockerd &` | socket |

### Non-obvious caveats

1. **Fastify/WebSocket version conflict**: The original `@fastify/websocket@11.2.0` requires Fastify 5.x but the project uses Fastify 4.x. The fix is `@fastify/websocket@10.0.1` which is Fastify-4-compatible. This has been applied via `bun add`.

2. **Schema drift**: After running `prisma migrate deploy`, you may still need `bunx prisma db push` to sync columns like `lockedAt` and `webhookSecret` unique constraints that are in the schema but not in migrations.

3. **ENCRYPTION_KEY warning**: On first start without `ENCRYPTION_KEY` in `.env`, the server logs a warning and generates a random key. Add the logged key to `.env` to persist encrypted project env vars across restarts.

4. **Server starts without DATABASE_URL**: If `DATABASE_URL` is not set, the server skips migrations/reconciliation and serves the setup wizard at `/setup`.

5. **Dashboard build output**: `bun run build` in `dashboard/` outputs to `dashboard/out/`, which the backend serves as static files via `@fastify/static`.

### Lint / Typecheck / Build

See `package.json` scripts. Key commands:
- **Backend typecheck**: `bunx tsc --noEmit` (from root)
- **Dashboard lint**: `cd dashboard && bunx eslint .` (pre-existing shadcn warnings are expected)
- **Dashboard typecheck + build**: `cd dashboard && bun run build`
