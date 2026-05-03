import { existsSync } from "fs";

/** Sudo often uses a minimal PATH; prefer these absolute paths (same list as Settings → SSL). */
export const CERTBOT_PATH_CANDIDATES = [
  "/usr/bin/certbot",
  "/snap/bin/certbot",
  "/usr/local/bin/certbot",
  "/opt/certbot/bin/certbot",
  "/opt/homebrew/bin/certbot",
] as const;

export function findCertbotExecutablePath(): string | null {
  for (const p of CERTBOT_PATH_CANDIDATES) {
    if (existsSync(p)) return p;
  }
  return null;
}
