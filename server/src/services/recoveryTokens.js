import { createHash, randomBytes } from "node:crypto";

export const RECOVERY_TOKEN_LIFETIME_MS = 30 * 60 * 1000;

export function hashRecoveryToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

export function issueRecoveryToken(now = Date.now()) {
  const token = randomBytes(32).toString("base64url");
  return {
    token,
    hash: hashRecoveryToken(token),
    expiresAt: new Date(now + RECOVERY_TOKEN_LIFETIME_MS),
  };
}
