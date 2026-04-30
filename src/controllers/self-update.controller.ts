import type { FastifyReply, FastifyRequest } from "fastify";
import { selfUpdateBranchLive, selfUpdateSecretLive } from "../config/env";
import { logger } from "../utils/logger";
import {
  applySelfUpdate,
  getSelfUpdateStatus,
  selfUpdateTokensMatch,
} from "../services/self-update.service";

function unauthorized(reply: FastifyReply): void {
  reply.code(401).send({ error: "Unauthorized", message: "Invalid or missing credentials" });
}

function featureDisabled(reply: FastifyReply): void {
  reply.code(503)
    .send({ error: "NotConfigured", message: "Set SELF_UPDATE_SECRET in .env to enable self-update endpoints" });
}

function bearerToken(req: FastifyRequest): string | undefined {
  const h = req.headers.authorization;
  if (!h?.startsWith("Bearer ")) return undefined;
  return h.slice("Bearer ".length).trim();
}

export async function selfUpdateStatusHandler(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const secret = selfUpdateSecretLive();
  if (!secret) {
    featureDisabled(reply);
    return;
  }
  const token = bearerToken(req);
  if (!token || !selfUpdateTokensMatch(token, secret)) {
    unauthorized(reply);
    return;
  }
  const status = await getSelfUpdateStatus(selfUpdateBranchLive());
  reply.code(200).send(status);
}

export async function selfUpdateApplyHandler(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const secret = selfUpdateSecretLive();
  if (!secret) {
    featureDisabled(reply);
    return;
  }
  const token = bearerToken(req);
  if (!token || !selfUpdateTokensMatch(token, secret)) {
    unauthorized(reply);
    return;
  }
  const result = await applySelfUpdate(selfUpdateBranchLive());
  reply.code(200).send(result);
}

/** Fire-and-forget hook for CI or cron: `POST ?token=...` (same value as SELF_UPDATE_SECRET). */
export async function selfUpdateWebhookHandler(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const secret = selfUpdateSecretLive();
  if (!secret) {
    featureDisabled(reply);
    return;
  }
  const q = req.query as { token?: string };
  const token = typeof q.token === "string" ? q.token : "";
  if (!selfUpdateTokensMatch(token, secret)) {
    unauthorized(reply);
    return;
  }

  const status = await getSelfUpdateStatus(selfUpdateBranchLive());
  if (!status.isGitRepo || status.message) {
    reply.code(200).send({ ok: false, skipped: true, reason: status.message ?? "Not a git repo" });
    return;
  }
  if (!status.behind) {
    reply.code(200).send({ ok: true, skipped: true, reason: "Already up to date" });
    return;
  }

  void applySelfUpdate(selfUpdateBranchLive()).then((r) => {
    logger.info(r, "Self-update webhook apply finished");
  });

  reply.code(202).send({ ok: true, accepted: true, message: "Update started" });
}
