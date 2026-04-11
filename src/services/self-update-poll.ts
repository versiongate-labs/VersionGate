import {
  selfUpdateAutoApplyLive,
  selfUpdateBranchLive,
  selfUpdatePollMsLive,
  selfUpdateSecretLive,
} from "../config/env";
import { logger } from "../utils/logger";
import { applySelfUpdate, getSelfUpdateStatus } from "./self-update.service";

let timer: ReturnType<typeof setTimeout> | null = null;

function scheduleNext(): void {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  const secret = selfUpdateSecretLive();
  const ms = selfUpdatePollMsLive();
  if (!secret || ms <= 0) return;
  timer = setTimeout(() => void runTick(), ms);
}

async function runTick(): Promise<void> {
  timer = null;
  try {
    const branch = selfUpdateBranchLive();
    const s = await getSelfUpdateStatus(branch);
    if (!s.isGitRepo || s.message || !s.behind) {
      scheduleNext();
      return;
    }
    if (selfUpdateAutoApplyLive()) {
      logger.info({ branch }, "Self-update poll: applying (auto)");
      const r = await applySelfUpdate(branch);
      if (!r.ok) logger.warn({ err: r.error }, "Self-update poll: apply failed");
    } else {
      logger.info(
        { branch, local: s.currentCommit, remote: s.remoteCommit },
        "Self-update: origin is ahead — apply from Settings or POST /api/v1/system/update/apply"
      );
    }
  } catch (err) {
    logger.warn({ err }, "Self-update poll error");
  } finally {
    scheduleNext();
  }
}

/** (Re)start polling from current process env — call after enabling self-update or changing poll interval in .env. */
export function kickSelfUpdatePoll(): void {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  const secret = selfUpdateSecretLive();
  const ms = selfUpdatePollMsLive();
  if (secret && ms > 0) {
    logger.info({ pollMs: ms, autoApply: selfUpdateAutoApplyLive(), branch: selfUpdateBranchLive() }, "Self-update poll scheduled");
  }
  scheduleNext();
}

export function stopSelfUpdatePoll(): void {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
}
